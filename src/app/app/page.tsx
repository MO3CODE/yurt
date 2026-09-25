import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { StatCard } from "@/components/stat-card";
import { HeroPanel } from "@/components/hero-panel";
import { ProgressRing } from "@/components/progress-ring";
import { Card, CardContent, CardHeader, CardTitle, CardAction, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrayerTracker } from "@/components/student/prayer-tracker";
import { AttendanceToday } from "@/components/student/attendance-today";
import { TaskList } from "@/components/student/task-list";
import { Trophy, ListTodo, CalendarDays, BellRing, BookOpen, MapPin, ArrowUpLeft, Coffee, SprayCan, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayISO, dayOfWeekISO, greeting, hijriDate, longDate, weekStartISO } from "@/lib/date";
import type { PrayerName, PrayerStatus } from "@/lib/supabase/types";

export default async function StudentHomePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = todayISO();
  const todayDayOfWeek = dayOfWeekISO(today);

  const [
    { data: prayerRows },
    { data: attendanceRow },
    { data: tasks },
    { data: classesToday },
    { data: pointsRows },
    { data: notificationRows },
    { data: readRows },
    { data: wirdToday },
    { data: myCleaning },
  ] = await Promise.all([
    supabase.from("prayer_records").select("prayer, status").eq("student_id", user.id).eq("record_date", today),
    supabase.from("attendance_records").select("status, source").eq("student_id", user.id).eq("record_date", today).maybeSingle(),
    supabase.from("tasks").select("*").eq("student_id", user.id).eq("status", "pending").order("due_date", { ascending: true }).limit(5),
    supabase
      .from("class_schedule_entries")
      .select("*")
      .eq("student_id", user.id)
      .eq("day_of_week", todayDayOfWeek)
      .order("start_time"),
    supabase.from("points_entries").select("points").eq("student_id", user.id),
    supabase.from("notifications").select("id"),
    supabase.from("notification_reads").select("notification_id").eq("profile_id", user.id),
    supabase.from("quran_wird_logs").select("pages").eq("student_id", user.id).eq("record_date", today).maybeSingle(),
    supabase
      .from("cleaning_assignments")
      .select("id, status, task:cleaning_tasks!cleaning_assignments_task_id_fkey(name)")
      .eq("student_id", user.id)
      .eq("week_start_date", weekStartISO(today)),
  ]);

  const prayerValues: Partial<Record<PrayerName, PrayerStatus>> = {};
  for (const p of prayerRows ?? []) prayerValues[p.prayer] = p.status;
  const prayersDone = Object.values(prayerValues).filter((s) => s === "mosque" || s === "prayed").length;

  const totalPoints = (pointsRows ?? []).reduce((sum, p) => sum + p.points, 0);
  const readIds = new Set((readRows ?? []).map((r) => r.notification_id));
  const unreadCount = (notificationRows ?? []).filter((n) => !readIds.has(n.id)).length;
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="stagger flex flex-col gap-6">
      <HeroPanel>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2 text-xs font-medium text-sidebar-primary">
              <span className="size-1.5 rotate-45 bg-sidebar-primary" aria-hidden />
              {hijriDate()} · {longDate()}
            </span>
            <h1 className="font-heading text-2xl font-semibold text-sidebar-accent-foreground sm:text-3xl md:text-4xl">
              {greeting()}، {firstName}
            </h1>
            <p className="max-w-md text-sm text-sidebar-foreground/70">
              {prayersDone === 5
                ? "أتممت صلواتك الخمس اليوم — تقبّل الله منك."
                : prayersDone > 0
                  ? `سجّلت ${prayersDone} من ٥ صلوات حتى الآن، واصل!`
                  : "ابدأ يومك بتسجيل صلواتك وحضورك."}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/85"
                nativeButton={false}
                render={<Link href="/app/quran" />}
              >
                <BookOpen /> {wirdToday ? `وردك اليوم: ${wirdToday.pages ?? 0} صفحة` : "سجّل وردك"}
              </Button>
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  nativeButton={false}
                  render={<Link href="/app/notifications" />}
                >
                  <BellRing /> {unreadCount} إشعار جديد
                </Button>
              )}
            </div>
          </div>

          <ProgressRing
            value={prayersDone}
            max={5}
            size={128} stroke={10} boxClassName="size-24 md:size-32"
            className="text-sidebar-primary"
            trackClassName="text-sidebar-accent"
          >
            <div className="flex flex-col items-center leading-none">
              <span className="font-heading text-2xl font-semibold text-sidebar-accent-foreground tabular-nums md:text-3xl">
                {prayersDone}
                <span className="text-lg text-sidebar-foreground/50">/5</span>
              </span>
              <span className="mt-1 hidden text-[0.7rem] text-sidebar-foreground/60 md:block">صلوات اليوم</span>
            </div>
          </ProgressRing>
        </div>
      </HeroPanel>

      <div className="stagger grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="مجموع نقاطك" value={totalPoints} icon={Trophy} tone="gold" href="/app/points" />
        <StatCard label="مهام قيد الإنجاز" value={tasks?.length ?? 0} icon={ListTodo} href="/app/tasks" />
        <StatCard label="محاضرات اليوم" value={classesToday?.length ?? 0} icon={CalendarDays} tone="success" href="/app/schedule" />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>صلوات اليوم</CardTitle>
            <CardDescription>اضغط على الحالة لتسجيلها فوراً</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/app/prayers" />}>
                السجل <ArrowUpLeft />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <PrayerTracker date={today} values={prayerValues} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>حضورك الجامعي اليوم</CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceToday date={today} status={attendanceRow?.status} locked={!!attendanceRow && attendanceRow.source !== "self"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>مهمتك في النظافة هذا الأسبوع</CardTitle>
            </CardHeader>
            <CardContent>
              {myCleaning && myCleaning.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {myCleaning.map((a) => {
                    const taskName = (a.task as unknown as { name: string } | null)?.name ?? "مهمة نظافة";
                    return (
                      <li
                        key={a.id}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-xl border p-2.5",
                          a.status === "done" && "border-success/30 bg-success/[0.05]",
                          a.status === "missed" && "border-destructive/30 bg-destructive/[0.04]"
                        )}
                      >
                        <span className="flex items-center gap-2 font-medium">
                          <SprayCan className="size-4 text-primary" /> {taskName}
                        </span>
                        <span
                          className={cn(
                            "flex items-center gap-1 text-xs font-medium",
                            a.status === "done" ? "text-success" : a.status === "missed" ? "text-destructive" : "text-muted-foreground"
                          )}
                        >
                          {a.status === "done" ? <Check className="size-3.5" /> : a.status === "missed" ? <X className="size-3.5" /> : null}
                          {a.status === "done" ? "تمّت" : a.status === "missed" ? "لم تُنفَّذ" : "بانتظار التنفيذ"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-2 text-center text-sm text-muted-foreground">لا توجد مهمة نظافة عليك هذا الأسبوع</p>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader>
              <CardTitle>محاضرات اليوم</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/app/schedule" />}>
                  الجدول <ArrowUpLeft />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {classesToday && classesToday.length > 0 ? (
                <ol className="relative flex flex-col gap-3 border-s-2 border-dashed border-border ps-5">
                  {classesToday.map((c) => (
                    <li key={c.id} className="relative">
                      <span className="absolute top-1.5 -start-[1.63rem] size-3 rotate-45 rounded-[3px] border-2 border-card bg-primary" aria-hidden />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{c.course_name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums" dir="ltr">
                          {c.start_time.slice(0, 5)} – {c.end_time.slice(0, 5)}
                        </span>
                      </div>
                      {c.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {c.location}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center text-sm text-muted-foreground">
                  <Coffee className="size-6 text-gold" />
                  لا محاضرات اليوم — وقت مناسب للمراجعة
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مهامك القادمة</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/app/tasks" />}>
              عرض الكل <ArrowUpLeft />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TaskList tasks={tasks ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
