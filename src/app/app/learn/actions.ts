"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/date";

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
