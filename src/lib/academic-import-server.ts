import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { subjectKey } from "@/lib/academic";

type Db = SupabaseClient<Database>;

/** يرجع معرّف كل مادة بحسب مفتاحها (يطابق «الرياضيات» مع «رياضيات»)، وينشئ الناقص */
export async function resolveSubjects(supabase: Db, names: string[]): Promise<Map<string, string>> {
  const { data: existing, error } = await supabase.from("academic_subjects").select("id, name");
  if (error) throw new Error(error.message);
  const byKey = new Map((existing ?? []).map((s) => [subjectKey(s.name), s.id]));

  const missing = new Map<string, string>();
  for (const raw of names) {
    const key = subjectKey(raw);
    if (key && !byKey.has(key) && !missing.has(key)) missing.set(key, raw.trim());
  }
  if (missing.size > 0) {
    const { data, error: insertError } = await supabase
      .from("academic_subjects")
      .insert([...missing.values()].map((name) => ({ name })))
      .select("id, name");
    if (insertError) throw new Error(insertError.message);
    for (const s of data ?? []) byKey.set(subjectKey(s.name), s.id);
  }
  return byKey;
}

export type AcademicRow = {
  studentId: string;
  gpa: number | null;
  gpaScale: number;
  strong: string[];
  struggling: string[];
};

/**
 * يكتب الملفات الأكاديمية دفعة واحدة. المعدل يُحدَّث فقط إن وُجد في الصف.
 * replace: مواد الصف تحلّ محل مواد الطالب الحالية (استيراد الجدول الأكاديمي)؛
 * وإلا تُضاف/تُحدَّث دون حذف ما عداها (استيراد الطلاب، حيث تُذكر المواد المتعثرة فقط).
 * في الحالتين: إن خلا الصف من المواد تبقى مواد الطالب كما هي.
 */
export async function applyAcademicRows(supabase: Db, input: AcademicRow[], opts: { replace: boolean }): Promise<{ students: number; subjects: number }> {
  // صف واحد لكل طالب (الأخير يغلب) لأن الحفظ الجماعي لا يقبل المفتاح نفسه مرتين
  const rows = [...new Map(input.map((r) => [r.studentId, r])).values()];
  if (rows.length === 0) return { students: 0, subjects: 0 };

  const withGpa = rows.filter((r) => r.gpa !== null);
  const withoutGpa = rows.filter((r) => r.gpa === null);
  if (withGpa.length > 0) {
    const { error } = await supabase.from("student_academic_profiles").upsert(
      withGpa.map((r) => ({ student_id: r.studentId, gpa: r.gpa, gpa_scale: r.gpaScale })),
      { onConflict: "student_id" }
    );
    if (error) throw new Error(error.message);
  }
  if (withoutGpa.length > 0) {
    // يضمن وجود ملف للطالب دون المساس بمعدل سابق
    const { error } = await supabase
      .from("student_academic_profiles")
      .upsert(withoutGpa.map((r) => ({ student_id: r.studentId })), { onConflict: "student_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  const withSubjects = rows.filter((r) => r.strong.length + r.struggling.length > 0);
  let subjectCount = 0;
  if (withSubjects.length > 0) {
    const byKey = await resolveSubjects(supabase, withSubjects.flatMap((r) => [...r.strong, ...r.struggling]));

    const wanted: { student_id: string; subject_id: string; standing: "strong" | "struggling" }[] = [];
    for (const r of withSubjects) {
      const perStudent = new Map<string, "strong" | "struggling">();
      for (const n of r.strong) {
        const id = byKey.get(subjectKey(n));
        if (id) perStudent.set(id, "strong");
      }
      for (const n of r.struggling) {
        const id = byKey.get(subjectKey(n));
        if (id) perStudent.set(id, "struggling"); // التعثر يغلب إن ذُكرت المادة في العمودين
      }
      for (const [subject_id, st] of perStudent) wanted.push({ student_id: r.studentId, subject_id, standing: st });
    }

    const { error } = await supabase.from("student_subjects").upsert(wanted, { onConflict: "student_id,subject_id" });
    if (error) throw new Error(error.message);
    subjectCount = wanted.length;

    if (opts.replace) {
      const wantedKeys = new Set(wanted.map((w) => `${w.student_id}:${w.subject_id}`));
      const { data: existing, error: existingError } = await supabase
        .from("student_subjects")
        .select("id, student_id, subject_id")
        .in("student_id", withSubjects.map((r) => r.studentId));
      if (existingError) throw new Error(existingError.message);
      const stale = (existing ?? []).filter((e) => !wantedKeys.has(`${e.student_id}:${e.subject_id}`)).map((e) => e.id);
      if (stale.length > 0) {
        const { error: deleteError } = await supabase.from("student_subjects").delete().in("id", stale);
        if (deleteError) throw new Error(deleteError.message);
      }
    }
  }
  return { students: rows.length, subjects: subjectCount };
}
