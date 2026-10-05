"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/date";
import { writingTopics } from "@/lib/learning/writing";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح");

function refresh(courseId: string) {
  revalidatePath("/app");
  revalidatePath("/app/tasks");
  revalidatePath("/app/learn", "layout");
  revalidatePath(`/app/learn/${courseId}`, "layout");
}

function validTarget(target: string, today: string) {
  if (target < today) throw new Error("موعد الإنهاء يجب أن يكون اليوم أو بعده");
  if (target > addDaysISO(today, 366)) throw new Error("موعد الإنهاء أبعد من سنة");
}

export async function enrollCourse(courseId: string, targetDate: string) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== "student") throw new Error("الانضمام للكورسات للطلاب فقط");
    const today = todayISO();
    const target = dateSchema.parse(targetDate);
    validTarget(target, today);
    const supabase = await createClient();
    const { error } = await supabase
      .from("course_enrollments")
      .insert({ student_id: user.id, course_id: z.string().uuid().parse(courseId), started_on: today, target_date: target });
    if (error) throw new Error(error.code === "23505" ? "أنت منضم لهذا الكورس بالفعل" : error.message);
    refresh(courseId);
  });
}

export async function changeTargetDate(courseId: string, targetDate: string) {
  return runAction(async () => {
    const user = await requireUser();
    const target = dateSchema.parse(targetDate);
    validTarget(target, todayISO());
    const supabase = await createClient();
    const { error } = await supabase.from("course_enrollments").update({ target_date: target }).eq("student_id", user.id).eq("course_id", courseId);
    if (error) throw new Error(error.message);
    refresh(courseId);
  });
}

/** مغادرة الكورس تحذف الانضمام والتقدّم */
export async function leaveCourse(courseId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const supabase = await createClient();
    const [a, b] = await Promise.all([
      supabase.from("course_unit_progress").delete().eq("student_id", user.id).eq("course_id", courseId),
      supabase.from("course_enrollments").delete().eq("student_id", user.id).eq("course_id", courseId),
    ]);
    if (a.error || b.error) throw new Error((a.error ?? b.error)!.message);
    refresh(courseId);
  });
}

export type CompleteUnitResult = { done: number; total: number; course_completed: boolean; points: number };

export async function completeUnit(unitId: string, courseId: string) {
  return runAction(async () => {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("complete_course_unit", { p_unit: z.string().uuid().parse(unitId) });
    if (error) throw new Error(error.message);
    refresh(courseId);
    return data as CompleteUnitResult;
  });
}

export async function uncompleteUnit(unitId: string, courseId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("course_unit_progress").delete().eq("student_id", user.id).eq("unit_id", unitId);
    if (error) throw new Error(error.message);
    refresh(courseId);
  });
}

const submissionSchema = z.object({
  unitId: z.string().uuid(),
  topic: z.string().trim().min(1, "اختر الموضوع").max(300),
  paths: z.array(z.string().max(300)).min(1, "ارفع صورة الورقة").max(6, "حتى ست صور"),
  note: z.string().trim().max(1000).nullable(),
});

/**
 * يسجّل تسليم تدريب الكتابة بعد رفع الصور إلى المخزن الخاص من المتصفح،
 * ويُتم الوحدة في جدول الطالب (التقييم والنقاط عند مراجعة الإدارة).
 */
export async function submitWriting(input: z.input<typeof submissionSchema>) {
  return runAction(async () => {
    const user = await requireUser();
    const v = submissionSchema.parse(input);
    // الصور يجب أن تكون في مجلد الطالب نفسه (سياسة المخزن تفرض ذلك أيضاً)
    if (!v.paths.every((p) => p.startsWith(`${user.id}/${v.unitId}/`))) throw new Error("مسار صورة غير صالح");

    const supabase = await createClient();
    const { data: unit } = await supabase.from("course_units").select("course_id, kind, content").eq("id", v.unitId).single();
    if (!unit || unit.kind !== "writing") throw new Error("التدريب غير موجود");
    const topics = writingTopics(unit.content);
    if (!topics.includes(v.topic)) throw new Error("اختر موضوعاً من القائمة");

    const { error } = await supabase.from("writing_submissions").insert({
      student_id: user.id,
      unit_id: v.unitId,
      course_id: unit.course_id,
      topic: v.topic,
      image_paths: v.paths,
      note: v.note,
    });
    if (error) throw new Error(error.message);

    const { data: progress } = await supabase.rpc("complete_course_unit", { p_unit: v.unitId });
    refresh(unit.course_id);
    return progress as CompleteUnitResult | null;
  });
}
