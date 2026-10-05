import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/date";
import { GRADES_BUCKET, REPORT_KINDS, windowOf, windowState, type AcademicTerm, type ReportKind } from "@/lib/grades";

type Db = Awaited<ReturnType<typeof createClient>>;

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

/** ترمات الطالب وكشوفه (مع روابط موقّعة لساعة للملفات) */
export async function getStudentGrades(supabase: Db, studentId: string) {
  const [{ data: terms }, { data: reports }] = await Promise.all([
    supabase.from("academic_terms").select("*").order("midterm_from", { ascending: false }),
    supabase.from("grade_reports").select("*").eq("student_id", studentId),
  ]);
  const rows = (reports ?? []) as ReportRow[];
  const paths = rows.flatMap((r) => r.file_paths);
  const { data: signed } = paths.length ? await supabase.storage.from(GRADES_BUCKET).createSignedUrls(paths, 3600) : { data: [] };
  const urlBy = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return { terms: (terms ?? []) as AcademicTerm[], reports: rows, urlBy };
}

export type GradeTask = { termId: string; termName: string; kind: ReportKind; due: string; overdue: boolean };

/**
 * مهام الرفع: كل فترة مفتوحة لم يرفع فيها الطالب، وأيضاً ما انتهت فترته خلال آخر ٣٠ يوماً ولم يُرفع (متأخر).
 */
export async function getGradeTasks(supabase: Db, studentId: string, today: string): Promise<GradeTask[]> {
  const [{ data: terms }, { data: reports }] = await Promise.all([
    supabase.from("academic_terms").select("*").gte("final_to", addDaysISO(today, -30)),
    supabase.from("grade_reports").select("term_id, kind").eq("student_id", studentId),
  ]);
  const have = new Set((reports ?? []).map((r) => `${r.term_id}:${r.kind}`));
  const tasks: GradeTask[] = [];
  for (const term of (terms ?? []) as AcademicTerm[]) {
    for (const kind of REPORT_KINDS) {
      if (have.has(`${term.id}:${kind}`)) continue;
      const state = windowState(term, kind, today);
      const { to } = windowOf(term, kind);
      if (state === "open" || (state === "closed" && to >= addDaysISO(today, -30))) {
        tasks.push({ termId: term.id, termName: term.name, kind, due: to, overdue: state === "closed" });
      }
    }
  }
  return tasks.sort((a, b) => a.due.localeCompare(b.due));
}
