"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { applyAcademicRows, resolveSubjects } from "@/lib/academic-import-server";
import { subjectKey } from "@/lib/academic";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح");
const standing = z.enum(["strong", "struggling"]);
const subjectName = z.string().trim().min(1).max(80);

function refreshAcademic() {
  revalidatePath("/admin/academic", "layout");
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------
// ملف الطالب وجلسات التقييم
// ---------------------------------------------------------------------

const recordSchema = z
  .object({
    studentId: z.string().uuid(),
    recordSession: z.boolean(),
    sessionDate: isoDate.optional(),
    gpa: z.number().min(0).nullable(),
    gpaScale: z.number().positive().max(100),
    summary: z.string().trim().max(4000).optional(),
    actionItems: z.string().trim().max(4000).optional(),
    nextSessionDate: isoDate.nullable().optional(),
    subjects: z
      .array(z.object({ name: subjectName, standing, grade: z.number().min(0).max(100).nullable().optional() }))
      .max(60),
  })
  .refine((v) => v.gpa === null || v.gpa <= v.gpaScale, { message: "المعدل أكبر من المقياس المختار" })
  .refine((v) => !v.recordSession || !!v.sessionDate, { message: "تاريخ الجلسة مطلوب" });

export type SaveAcademicRecordInput = z.input<typeof recordSchema>;

/** يحفظ ملف الطالب (المعدل + المواد) وموعد الجلسة القادمة، ويسجّل جلسة تقييم إن طُلب */
export async function saveAcademicRecord(input: SaveAcademicRecordInput): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = recordSchema.parse(input);
    const supabase = await createClient();

    // المواد: آخر تصنيف لمادة مكررة هو المعتمد
    const byKey = await resolveSubjects(supabase, v.subjects.map((s) => s.name));
    const finalRows = new Map<string, { subject_id: string; standing: "strong" | "struggling"; grade: number | null }>();
    for (const s of v.subjects) {
      const subjectId = byKey.get(subjectKey(s.name));
      if (subjectId) finalRows.set(subjectId, { subject_id: subjectId, standing: s.standing, grade: s.grade ?? null });
    }

    const { data: current, error: currentError } = await supabase
      .from("student_subjects")
      .select("id, subject_id")
      .eq("student_id", v.studentId);
    if (currentError) throw new Error(currentError.message);

    if (finalRows.size > 0) {
      const { error } = await supabase.from("student_subjects").upsert(
        [...finalRows.values()].map((r) => ({ student_id: v.studentId, ...r })),
        { onConflict: "student_id,subject_id" }
      );
      if (error) throw new Error(error.message);
    }
    const removed = (current ?? []).filter((c) => !finalRows.has(c.subject_id)).map((c) => c.id);
    if (removed.length > 0) {
      const { error } = await supabase.from("student_subjects").delete().in("id", removed);
      if (error) throw new Error(error.message);
    }

    if (v.recordSession) {
      const { error } = await supabase.from("assessment_sessions").insert({
        student_id: v.studentId,
        session_date: v.sessionDate!,
        conducted_by: user.id,
        gpa: v.gpa,
        gpa_scale: v.gpaScale,
        summary: v.summary || null,
        action_items: v.actionItems || null,
        next_session_date: v.nextSessionDate ?? null,
      });
      if (error) throw new Error(error.message);
    }

    const { error: profileError } = await supabase.from("student_academic_profiles").upsert(
      {
        student_id: v.studentId,
        gpa: v.gpa,
        gpa_scale: v.gpaScale,
        next_session_at: v.nextSessionDate ?? null,
        ...(v.recordSession ? { last_session_at: v.sessionDate } : {}),
      },
      { onConflict: "student_id" }
    );
    if (profileError) throw new Error(profileError.message);

    refreshAcademic();
  });
}

// ---------------------------------------------------------------------
// الاستيراد الجماعي من جدول
// ---------------------------------------------------------------------

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        gpa: z.number().min(0).nullable(),
        gpaScale: z.number().positive().max(100),
        strong: z.array(subjectName).max(30),
        struggling: z.array(subjectName).max(30),
      })
    )
    .min(1, "لا توجد صفوف للاستيراد")
    .max(200, "الحد الأقصى ٢٠٠ طالب في المرة الواحدة"),
});

export type ImportAcademicInput = z.input<typeof importSchema>;

/**
 * يملأ الملفات الأكاديمية دفعة واحدة. المواد: إن وُجدت مواد في الصف فهي تحلّ محل مواد الطالب الحالية،
 * وإن خلا الصف منها تبقى مواده كما هي. المعدل يُحدَّث فقط إن وُجد في الصف.
 */
export async function importAcademicData(input: ImportAcademicInput): Promise<ActionResult<{ students: number; subjects: number }>> {
  return runAction(async () => {
    await assertPermission("academic");
    const parsed = importSchema.parse(input);
    const supabase = await createClient();
    const result = await applyAcademicRows(supabase, parsed.rows, { replace: true });
    refreshAcademic();
    return result;
  });
}

// ---------------------------------------------------------------------
// خطوات المعالجة لكل مادة
// ---------------------------------------------------------------------

const subjectActionSchema = z.object({
  subjectId: z.string().uuid(),
  title: z.string().trim().min(1, "عنوان الخطوة مطلوب").max(160),
  tutorName: z.string().trim().max(120).optional(),
  dueDate: isoDate.nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function createSubjectAction(input: z.input<typeof subjectActionSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = subjectActionSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("subject_actions").insert({
      subject_id: v.subjectId,
      title: v.title,
      tutor_name: v.tutorName || null,
      due_date: v.dueDate ?? null,
      notes: v.notes || null,
      created_by: user.id,
    });
    if (error) throw new Error(error.message);
    refreshAcademic();
  });
}

export async function setSubjectActionStatus(
  actionId: string,
  status: "planned" | "in_progress" | "done"
): Promise<ActionResult> {
  return runAction(async () => {
    await assertPermission("academic");
    const supabase = await createClient();
    const { error } = await supabase
      .from("subject_actions")
      .update({ status: z.enum(["planned", "in_progress", "done"]).parse(status) })
      .eq("id", z.string().uuid().parse(actionId));
    if (error) throw new Error(error.message);
    refreshAcademic();
  });
}

export async function deleteSubjectAction(actionId: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertPermission("academic");
    const supabase = await createClient();
    const { error } = await supabase.from("subject_actions").delete().eq("id", z.string().uuid().parse(actionId));
    if (error) throw new Error(error.message);
    refreshAcademic();
  });
}

// ---------------------------------------------------------------------
// سجل تذكيرات واتساب
// ---------------------------------------------------------------------

const reminderSchema = z.object({
  studentId: z.string().uuid(),
  kind: z.enum(["session", "grades", "tutoring", "custom"]),
  subjectId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(2000),
});

export async function logReminder(input: z.input<typeof reminderSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = reminderSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("academic_reminders").insert({
      student_id: v.studentId,
      kind: v.kind,
      subject_id: v.subjectId ?? null,
      message: v.message,
      sent_by: user.id,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/academic/reminders");
  });
}

// ---------------------------------------------------------------------
// خطة المتابعة
// ---------------------------------------------------------------------

const planFields = {
  track: z.enum(["academic", "skills", "development", "other"]),
  phase: z.string().trim().max(120).nullable().optional(),
  title: z.string().trim().min(1, "عنوان البند مطلوب").max(300),
  notes: z.string().trim().max(2000).nullable().optional(),
  dueDate: isoDate.nullable().optional(),
};
const planItemSchema = z.object(planFields);
const planImportSchema = z.object({
  replace: z.boolean(),
  items: z
    .array(
      z.object({
        track: planFields.track,
        phase: planFields.phase,
        title: planFields.title,
        status: z.enum(["todo", "in_progress", "done", "blocked"]),
        due: isoDate.nullable(),
      })
    )
    .min(1, "لا توجد بنود للاستيراد")
    .max(300, "الحد الأقصى ٣٠٠ بند في المرة الواحدة"),
});

async function nextSortOrder(supabase: Supabase): Promise<number> {
  const { data } = await supabase.from("follow_up_plan_items").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  return (data?.[0]?.sort_order ?? 0) + 10;
}

export async function createPlanItem(input: z.input<typeof planItemSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = planItemSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("follow_up_plan_items").insert({
      track: v.track,
      phase: v.phase || null,
      title: v.title,
      notes: v.notes || null,
      due_date: v.dueDate ?? null,
      sort_order: await nextSortOrder(supabase),
      created_by: user.id,
    });
    if (error) throw new Error(error.message);
    refreshAcademic();
  });
}

export async function updatePlanItem(itemId: string, input: z.input<typeof planItemSchema>): Promise<ActionResult> {
  return runAction(async () => {
    await assertPermission("academic");
    const v = planItemSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("follow_up_plan_items")
      .update({
        track: v.track,
        phase: v.phase || null,
        title: v.title,
        notes: v.notes || null,
        due_date: v.dueDate ?? null,
      })
      .eq("id", z.string().uuid().parse(itemId));
    if (error) throw new Error(error.message);
    refreshAcademic();
  });
}

export async function setPlanItemStatus(
  itemId: string,
  status: "todo" | "in_progress" | "done" | "blocked"
): Promise<ActionResult> {
  return runAction(async () => {
    await assertPermission("academic");
    const supabase = await createClient();
    const { error } = await supabase
      .from("follow_up_plan_items")
      .update({ status: z.enum(["todo", "in_progress", "done", "blocked"]).parse(status) })
      .eq("id", z.string().uuid().parse(itemId));
    if (error) throw new Error(error.message);
    refreshAcademic();
  });
}

export async function deletePlanItem(itemId: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertPermission("academic");
    const supabase = await createClient();
    const { error } = await supabase.from("follow_up_plan_items").delete().eq("id", z.string().uuid().parse(itemId));
    if (error) throw new Error(error.message);
    refreshAcademic();
  });
}

/** يرفع خطة كاملة؛ replace يحذف البنود الحالية أولاً (لإعادة رفع نسخة محدَّثة) */
export async function importPlanItems(input: z.input<typeof planImportSchema>): Promise<ActionResult<number>> {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = planImportSchema.parse(input);
    const supabase = await createClient();

    if (v.replace) {
      const { error } = await supabase.from("follow_up_plan_items").delete().not("id", "is", null);
      if (error) throw new Error(error.message);
    }
    const base = v.replace ? 0 : await nextSortOrder(supabase);
    const { error } = await supabase.from("follow_up_plan_items").insert(
      v.items.map((it, i) => ({
        track: it.track,
        phase: it.phase || null,
        title: it.title,
        status: it.status,
        due_date: it.due,
        sort_order: base + (i + 1) * 10,
        created_by: user.id,
      }))
    );
    if (error) throw new Error(error.message);
    refreshAcademic();
    return v.items.length;
  });
}
