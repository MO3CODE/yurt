import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/date";
import { GRADES_BUCKET, REPORT_KINDS, windowOf, windowState, type AcademicTerm, type ReportKind } from "@/lib/grades";

type Db = Awaited<ReturnType<typeof createClient>>;

export type ReportCourseRow = {
  id: string;
  report_id: string;
  sort_order: number;
  course_code: string | null;
  course_name: string;
  credits: number;
  letter: string | null;
  percent: number | null;
  is_repeat: boolean;
  help_requested: boolean;
  points: number | null;
  risk_level: string | null;
};

export type ReportRow = {
  id: string;
  student_id: string;
  term_id: string;
  kind: string;
  status: string;
  file_paths: string[];
  term_gpa: number | null;
  cumulative_gpa: number | null;
  verified_term_gpa: number | null;
  verified_cumulative_gpa: number | null;
  note: string | null;
  admin_note: string | null;
  created_at: string;
};

/** ترمات الطالب وكشوفه ومواد كل كشف (مع روابط موقّعة لساعة للملفات) */
export async function getStudentGrades(supabase: Db, studentId: string) {
  const [{ data: terms }, { data: reports }, { data: courses }] = await Promise.all([
    supabase.from("academic_terms").select("*").order("midterm_from", { ascending: false }),
    supabase.from("grade_reports").select("*").eq("student_id", studentId),
    supabase.from("grade_report_courses").select("*").eq("student_id", studentId).order("sort_order"),
  ]);
  const coursesByReport = new Map<string, ReportCourseRow[]>();
  for (const c of (courses ?? []) as ReportCourseRow[]) coursesByReport.set(c.report_id, [...(coursesByReport.get(c.report_id) ?? []), c]);
  const rows = (reports ?? []) as ReportRow[];
  const paths = rows.flatMap((r) => r.file_paths);
  const { data: signed } = paths.length ? await supabase.storage.from(GRADES_BUCKET).createSignedUrls(paths, 3600) : { data: [] };
  const urlBy = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return { terms: (terms ?? []) as AcademicTerm[], reports: rows, urlBy, coursesByReport };
}

export type GradeTask = { termId: string; termName: string; kind: ReportKind; due: string; overdue: boolean; returned?: boolean };

/**
 * مهام الرفع: كل فترة مفتوحة لم يرفع فيها الطالب، وأيضاً ما انتهت فترته خلال آخر ٣٠ يوماً ولم يُرفع (متأخر)،
 * وكل كشف أعادته الإدارة للتعديل.
 */
export async function getGradeTasks(supabase: Db, studentId: string, today: string): Promise<GradeTask[]> {
  const [{ data: terms }, { data: reports }] = await Promise.all([
    supabase.from("academic_terms").select("*").gte("final_to", addDaysISO(today, -30)),
    supabase.from("grade_reports").select("term_id, kind, status").eq("student_id", studentId),
  ]);
  const statusOf = new Map((reports ?? []).map((r) => [`${r.term_id}:${r.kind}`, r.status]));
  const tasks: GradeTask[] = [];
  for (const term of (terms ?? []) as AcademicTerm[]) {
    for (const kind of REPORT_KINDS) {
      const status = statusOf.get(`${term.id}:${kind}`);
      if (status === "returned") {
        tasks.push({ termId: term.id, termName: term.name, kind, due: windowOf(term, kind).to, overdue: false, returned: true });
        continue;
      }
      if (status) continue;
      const state = windowState(term, kind, today);
      const { to } = windowOf(term, kind);
      if (state === "open" || (state === "closed" && to >= addDaysISO(today, -30))) {
        tasks.push({ termId: term.id, termName: term.name, kind, due: to, overdue: state === "closed" });
      }
    }
  }
  return tasks.sort((a, b) => a.due.localeCompare(b.due));
}
