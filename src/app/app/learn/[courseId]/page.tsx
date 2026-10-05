import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarClock, Clock, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EnrollDialog } from "@/components/learning/enroll-dialog";
import { LeaveCourseButton } from "@/components/learning/leave-course-button";
import { ScheduleBadge, daysLeftLabel } from "@/components/learning/schedule-badge";
import { UnitList } from "@/components/learning/unit-list";
import { formatLongDateISO, todayISO } from "@/lib/date";
import { arNum } from "@/lib/quran";
import {
  CATEGORY_LABELS,
  LEVEL_LABELS,
  courseSchedule,
  formatDuration,
  paceLabel,
  unitsLabel,
  type CourseCategory,
  type CourseLevel,
  type UnitKind,
} from "@/lib/learning";

export default async function CoursePage({ params }: PageProps<"/app/learn/[courseId]">) {
  const user = await requireUser();
  const { courseId } = await params;
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: course }, { data: units }, { data: enrollment }, { data: progress }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
    supabase.from("course_units").select("id, title, kind, duration_seconds").eq("course_id", courseId).order("position"),
    supabase.from("course_enrollments").select("*").eq("course_id", courseId).eq("student_id", user.id).maybeSingle(),
    supabase.from("course_unit_progress").select("unit_id").eq("course_id", courseId).eq("student_id", user.id),
  ]);
  if (!course) notFound();

  const doneSet = new Set((progress ?? []).map((p) => p.unit_id));
  const list = (units ?? []).map((u) => ({
    id: u.id,
    title: u.title,
    kind: u.kind as UnitKind,
    durationSeconds: u.duration_seconds,
    done: doneSet.has(u.id),
  }));
  const done = list.filter((u) => u.done).length;
  const totalSeconds = list.reduce((s, u) => s + (u.durationSeconds ?? 0), 0);
  const next = list.find((u) => !u.done) ?? list[0];
  const schedule = enrollment
    ? courseSchedule({ total: list.length, done, startedOn: enrollment.started_on, targetDate: enrollment.target_date, today })
    : null;
  const isStudent = user.role === "student";

  return (
    <div className="stagger flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href="/app/learn" />}>
        <ArrowRight /> المنصة التعليمية
      </Button>

      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="overflow-hidden rounded-2xl border bg-muted shadow-soft">
          {course.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.cover_url} alt="" className="aspect-video size-full object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-muted-foreground">
              <PlayCircle className="size-12" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{CATEGORY_LABELS[course.category as CourseCategory]}</Badge>
            {course.level && <Badge variant="outline">{LEVEL_LABELS[course.level as CourseLevel]}</Badge>}
            {!course.published && <Badge variant="destructive">غير منشور (معاينة)</Badge>}
          </div>
          <h1 className="font-heading text-2xl font-semibold leading-snug">{course.title}</h1>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <PlayCircle className="size-4" /> {unitsLabel(list.length)}
            </span>
            {totalSeconds > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-4" /> {formatDuration(totalSeconds)}
              </span>
            )}
          </p>

          {enrollment && schedule ? (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    <span className="font-semibold tabular-nums">
                      {arNum(done)} / {arNum(list.length)}
                    </span>{" "}
                    <span className="text-muted-foreground">درساً</span>
                  </span>
                  <ScheduleBadge state={schedule.state} behind={schedule.behind} />
                </div>
                <Progress value={list.length ? (done / list.length) * 100 : 0} aria-label="تقدّمك في الكورس" />
                {schedule.state !== "completed" && (
                  <p className="text-sm text-muted-foreground">
                    {schedule.todayCount > 0 ? `مطلوب اليوم: ${unitsLabel(schedule.todayCount)}` : "أنجزت ما عليك اليوم ✓"} ·{" "}
                    {paceLabel(schedule.perDay)}
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  الموعد: {formatLongDateISO(enrollment.target_date)} ({daysLeftLabel(schedule.daysLeft)})
                </p>
                <div className="flex flex-wrap gap-2">
                  {next && (
                    <Button nativeButton={false} render={<Link href={`/app/learn/${courseId}/${next.id}`} />}>
                      <PlayCircle /> {done === 0 ? "ابدأ" : done >= list.length ? "راجع الدروس" : "تابع"}
                    </Button>
                  )}
                  {schedule.state !== "completed" && (
                    <EnrollDialog
                      courseId={courseId}
                      totalUnits={list.length}
                      remainingUnits={list.length - done}
                      today={today}
                      currentTarget={enrollment.target_date}
                      trigger={<Button variant="outline">تغيير الموعد</Button>}
                    />
                  )}
                  <LeaveCourseButton courseId={courseId} />
                </div>
              </CardContent>
            </Card>
          ) : isStudent && course.published && list.length > 0 ? (
            <EnrollDialog
              courseId={courseId}
              totalUnits={list.length}
              remainingUnits={list.length}
              today={today}
              trigger={
                <Button size="lg" className="w-fit">
                  انضم للكورس
                </Button>
              }
            />
          ) : null}
        </div>
      </div>

      {course.description && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold">عن الكورس</h2>
          <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{course.description}</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">الدروس</h2>
        <UnitList units={list} hrefFor={enrollment ? (id) => `/app/learn/${courseId}/${id}` : undefined} />
        {!enrollment && isStudent && <p className="text-xs text-muted-foreground">انضم للكورس لتفتح الدروس وتظهر في مهامك اليومية.</p>}
      </section>
    </div>
  );
}
