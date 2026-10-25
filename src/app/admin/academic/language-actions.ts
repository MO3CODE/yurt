"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// متابعة سنة اللغة — صلاحية academic

const progressSchema = z.object({
  studentId: z.string().uuid(),
  levelsPassed: z.array(z.string().trim().min(1).max(10)).max(10),
  currentLevel: z.string().trim().max(20).nullable(),
  status: z.enum(["studying", "awaiting_result", "final_exam_prep", "last_chance", "completed"]),
  nextExamAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح").nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

function refresh(studentIds: string[]) {
  revalidatePath("/admin/academic/language");
  revalidatePath("/app/grades");
  for (const id of studentIds) revalidatePath(`/admin/academic/${id}`);
}

const toRow = (v: z.infer<typeof progressSchema>, userId: string) => ({
  student_id: v.studentId,
  levels_passed: v.levelsPassed,
  current_level: v.currentLevel || null,
  status: v.status,
  next_exam_at: v.nextExamAt,
  notes: v.notes || null,
  updated_by: userId,
});

export async function saveLanguageProgress(input: z.input<typeof progressSchema>) {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = progressSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("student_language_progress").upsert(toRow(v, user.id), { onConflict: "student_id" });
    if (error) throw new Error(error.message);
    refresh([v.studentId]);
  });
}

/** استيراد جدول طلاب اللغة من التقرير (يستبدل صف كل طالب) */
export async function importLanguageProgress(input: { rows: z.input<typeof progressSchema>[] }) {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const rows = z.array(progressSchema).min(1, "لا صفوف مطابقة").max(200).parse(input.rows);
    const supabase = await createClient();
    const { error } = await supabase.from("student_language_progress").upsert(rows.map((r) => toRow(r, user.id)), { onConflict: "student_id" });
    if (error) throw new Error(error.message);
    refresh(rows.map((r) => r.studentId));
    return { count: rows.length };
  });
}

export async function removeLanguageProgress(studentId: string) {
  return runAction(async () => {
    await assertPermission("academic");
    const id = z.string().uuid().parse(studentId);
    const supabase = await createClient();
    const { error } = await supabase.from("student_language_progress").delete().eq("student_id", id);
    if (error) throw new Error(error.message);
    refresh([id]);
  });
}
