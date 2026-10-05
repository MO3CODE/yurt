import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { courseSchedule, type CourseCategory, type UnitKind } from "@/lib/learning";

type Db = Awaited<ReturnType<typeof createClient>>;

export type LearningUnit = { id: string; position: number; title: string; kind: UnitKind; durationSeconds: number | null; done: boolean };

export type MyCourse = {
  id: string;
  title: string;
  category: CourseCategory;
  coverUrl: string | null;
  startedOn: string;
  targetDate: string;
  completedAt: string | null;
  units: LearningUnit[];
  done: number;
  schedule: ReturnType<typeof courseSchedule>;
  /** الدروس المقترحة لليوم (التالية غير المكتملة بعدد todayCount) */
  todayUnits: LearningUnit[];
};

/** كورسات الطالب المنضم إليها، بتقدّمه وجدوله ومهام اليوم */
export async function getMyCourses(supabase: Db, studentId: string, today: string): Promise<MyCourse[]> {
  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("course_id, started_on, target_date, completed_at, course:courses!course_enrollments_course_id_fkey(id, title, category, cover_url)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (!enrollments || enrollments.length === 0) return [];

  const courseIds = enrollments.map((e) => e.course_id);
  const [{ data: units }, { data: progress }] = await Promise.all([
    supabase
      .from("course_units")
      .select("id, course_id, position, title, kind, duration_seconds")
      .in("course_id", courseIds)
      .order("position"),
    supabase.from("course_unit_progress").select("unit_id").eq("student_id", studentId).in("course_id", courseIds),
  ]);
  const doneSet = new Set((progress ?? []).map((p) => p.unit_id));

  return enrollments.flatMap((e) => {
    const course = e.course as unknown as { id: string; title: string; category: CourseCategory; cover_url: string | null } | null;
    if (!course) return [];
    const list: LearningUnit[] = (units ?? [])
      .filter((u) => u.course_id === e.course_id)
      .map((u) => ({
        id: u.id,
        position: u.position,
        title: u.title,
        kind: u.kind as UnitKind,
        durationSeconds: u.duration_seconds,
        done: doneSet.has(u.id),
      }));
    const done = list.filter((u) => u.done).length;
    const schedule = courseSchedule({ total: list.length, done, startedOn: e.started_on, targetDate: e.target_date, today });
    return [
      {
        id: course.id,
        title: course.title,
        category: course.category,
        coverUrl: course.cover_url,
        startedOn: e.started_on,
        targetDate: e.target_date,
        completedAt: e.completed_at,
        units: list,
        done,
        schedule,
        todayUnits: list.filter((u) => !u.done).slice(0, schedule.state === "overdue" ? Math.min(3, list.length) : schedule.todayCount),
      },
    ];
  });
}
