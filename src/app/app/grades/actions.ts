"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import { GRADES_BUCKET, MAX_GRADE_FILES, canSubmit, type AcademicTerm } from "@/lib/grades";

const gpa = z.number().min(0, "المعدل بين ٠ و٤").max(4, "المعدل بين ٠ و٤ (مقياس ٤)").nullable();

const schema = z.object({
  termId: z.string().uuid(),
  kind: z.enum(["midterm", "final"]),
  paths: z.array(z.string().max(300)).min(1, "ارفع ملف الدرجات").max(MAX_GRADE_FILES, `حتى ${MAX_GRADE_FILES} ملفات`),
  termGpa: gpa,
  cumulativeGpa: gpa,
  note: z.string().trim().max(1000).nullable(),
});

/**
 * يسجّل كشف الدرجات بعد رفع الملفات من المتصفح إلى المخزن الخاص.
 * إن كان للطالب كشف سابق لم يُراجع يُستبدل (وتُحذف ملفاته القديمة).
 */
export async function submitGradeReport(input: z.input<typeof schema>) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== "student") throw new Error("رفع الدرجات للطلاب فقط");
    const v = schema.parse(input);
    if (!v.paths.every((p) => p.startsWith(`${user.id}/${v.termId}/`))) throw new Error("مسار ملف غير صالح");
    if (v.kind === "final" && (v.termGpa === null || v.cumulativeGpa === null)) throw new Error("اكتب المعدل الفصلي والتراكمي كما في كشفك");

    const supabase = await createClient();
    const { data: term } = await supabase.from("academic_terms").select("*").eq("id", v.termId).single();
    if (!term) throw new Error("الترم غير موجود");
    if (!canSubmit(term as AcademicTerm, v.kind, todayISO())) throw new Error("لم تُفتح فترة الرفع بعد");

    const { data: existing } = await supabase
      .from("grade_reports")
      .select("id, status, file_paths")
      .eq("student_id", user.id)
      .eq("term_id", v.termId)
      .eq("kind", v.kind)
      .maybeSingle();
    if (existing?.status === "reviewed") throw new Error("رُوجع كشفك بالفعل؛ تواصل مع الإدارة إن أردت تعديله");

    const values = {
      file_paths: v.paths,
      term_gpa: v.kind === "final" ? v.termGpa : null,
      cumulative_gpa: v.kind === "final" ? v.cumulativeGpa : null,
      note: v.note,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("grade_reports").update(values).eq("id", existing.id)
      : await supabase.from("grade_reports").insert({ ...values, student_id: user.id, term_id: v.termId, kind: v.kind });
    if (error) throw new Error(error.message);

    // الملفات القديمة لم تعد مستعملة
    const old = (existing?.file_paths ?? []).filter((p) => !v.paths.includes(p));
    if (old.length) await supabase.storage.from(GRADES_BUCKET).remove(old);

    revalidatePath("/app/grades");
    revalidatePath("/app/tasks");
    revalidatePath("/app");
  });
}
