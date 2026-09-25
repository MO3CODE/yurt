"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/current-user";

// المهام الأساسية المقترحة لأي شقة جديدة
const DEFAULT_APARTMENT_TASKS = ["المطبخ", "الحمام", "الصالة", "إخراج النفايات"];

const taskSchema = z.object({
  scope: z.enum(["apartment", "facility"]),
  apartment_id: z.string().uuid().optional(),
  facility_id: z.string().uuid().optional(),
  name: z.string().min(1, "اسم المهمة مطلوب"),
});

function revalidateCleaning() {
  revalidatePath("/admin/cleaning");
  revalidatePath("/app/apartment");
  revalidatePath("/app");
}

export async function createCleaningTask(formData: FormData) {
  return runAction(async () => {
    await assertPermission("cleaning");
    const parsed = taskSchema.parse({
      scope: formData.get("scope"),
      apartment_id: formData.get("apartment_id") || undefined,
      facility_id: formData.get("facility_id") || undefined,
      name: formData.get("name"),
    });

    const supabase = await createClient();
    const { error } = await supabase.from("cleaning_tasks").insert(parsed);
    if (error) throw new Error(error.message);

    // المهمة الجديدة تُوزَّع فوراً على هذا الأسبوع
    await supabase.rpc("generate_cleaning_schedule", parsed.scope === "apartment" ? { p_apartment: parsed.apartment_id } : {});
    revalidateCleaning();
  });
}

export async function createDefaultCleaningTasks(apartmentId: string): Promise<ActionResult<number>> {
  return runAction(async () => {
    await assertPermission("cleaning");
    const supabase = await createClient();
    const { error } = await supabase
      .from("cleaning_tasks")
      .insert(DEFAULT_APARTMENT_TASKS.map((name) => ({ scope: "apartment" as const, apartment_id: apartmentId, name })));
    if (error) throw new Error(error.message);

    const { data, error: genError } = await supabase.rpc("generate_cleaning_schedule", { p_apartment: apartmentId });
    if (genError) throw new Error(genError.message);
    revalidateCleaning();
    return data ?? 0;
  });
}

/** يوزّع المهام غير المعيّنة هذا الأسبوع (rebalance: يعيد توزيع كل ما لم يُنفَّذ بعد) */
export async function generateCleaningSchedule(rebalance: boolean): Promise<ActionResult<number>> {
  return runAction(async () => {
    await assertPermission("cleaning");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("generate_cleaning_schedule", { p_rebalance: rebalance });
    if (error) throw new Error(error.message);
    revalidateCleaning();
    return data ?? 0;
  });
}

export async function assignCleaning(taskId: string, weekStartDate: string, studentId: string) {
  return runAction(async () => {
    await assertPermission("cleaning");
    const supabase = await createClient();
    const { error } = await supabase
      .from("cleaning_assignments")
      .upsert(
        { task_id: taskId, week_start_date: weekStartDate, student_id: studentId, status: "pending" },
        { onConflict: "task_id,week_start_date" }
      );
    if (error) throw new Error(error.message);
    revalidateCleaning();
  });
}

export async function setCleaningStatus(assignmentId: string, status: "pending" | "done" | "missed") {
  return runAction(async () => {
    await assertPermission("cleaning");
    const supabase = await createClient();
    const { error } = await supabase
      .from("cleaning_assignments")
      .update({ status, verified_at: new Date().toISOString() })
      .eq("id", assignmentId);
    if (error) throw new Error(error.message);
    revalidateCleaning();
  });
}
