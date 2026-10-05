import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { Button } from "@/components/ui/button";
import { UnitList } from "@/components/learning/unit-list";
import { UnitPlayer } from "@/components/learning/unit-player";
import { arNum } from "@/lib/quran";
import { UNIT_KIND_LABELS, formatDuration, type UnitKind } from "@/lib/learning";

export default async function UnitPage({ params }: PageProps<"/app/learn/[courseId]/[unitId]">) {
  const user = await requireUser();
  const { courseId, unitId } = await params;
  const supabase = await createClient();

  const [{ data: course }, { data: units }, { data: enrollment }, { data: progress }] = await Promise.all([
    supabase.from("courses").select("id, title").eq("id", courseId).maybeSingle(),
    supabase.from("course_units").select("id, title, kind, duration_seconds, youtube_video_id").eq("course_id", courseId).order("position"),
    supabase.from("course_enrollments").select("course_id").eq("course_id", courseId).eq("student_id", user.id).maybeSingle(),
    supabase.from("course_unit_progress").select("unit_id").eq("course_id", courseId).eq("student_id", user.id),
  ]);
  if (!course || !units) notFound();
  // الإدارة تعاين بلا انضمام؛ الطالب يجب أن ينضم أولاً
  if (!enrollment && user.role === "student") redirect(`/app/learn/${courseId}`);

  const index = units.findIndex((u) => u.id === unitId);
  if (index === -1) notFound();
  const unit = units[index];
  const doneSet = new Set((progress ?? []).map((p) => p.unit_id));
  const href = (id: string) => `/app/learn/${courseId}/${id}`;

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href={`/app/learn/${courseId}`} />}>
        <ArrowRight /> {course.title}
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {UNIT_KIND_LABELS[unit.kind as UnitKind]} {arNum(index + 1)} من {arNum(units.length)}
              {unit.duration_seconds ? ` · ${formatDuration(unit.duration_seconds)}` : ""}
            </span>
            <h1 className="font-heading text-xl font-semibold leading-snug">{unit.title}</h1>
          </div>

          {unit.kind === "video" ? (
            <UnitPlayer
              key={unit.id}
              unitId={unit.id}
              courseId={courseId}
              videoId={unit.youtube_video_id}
              done={doneSet.has(unit.id)}
              nextHref={index < units.length - 1 ? href(units[index + 1].id) : null}
              prevHref={index > 0 ? href(units[index - 1].id) : null}
            />
          ) : (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">هذا النوع من الدروس يُتاح قريباً.</p>
          )}
        </div>

        <aside className="flex flex-col gap-2">
          <span className="text-sm font-medium">دروس الكورس</span>
          <UnitList
            units={units.map((u) => ({
              id: u.id,
              title: u.title,
              kind: u.kind as UnitKind,
              durationSeconds: u.duration_seconds,
              done: doneSet.has(u.id),
            }))}
            hrefFor={href}
            currentId={unit.id}
          />
        </aside>
      </div>
    </div>
  );
}
