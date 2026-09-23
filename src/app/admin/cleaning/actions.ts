"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/current-user";

const taskSchema = z.object({
  scope: z.enum(["apartment", "facility"]),
  apartment_id: z.string().uuid().optional(),
  facility_id: z.string().uuid().optional(),
  name: z.string().min(1, "اسم المهمة مطلوب"),
});

export async function createCleaningTask(formData: FormData) {
  await requireAdmin();
  const parsed = taskSchema.parse({
    scope: formData.get("scope"),
    apartment_id: formData.get("apartment_id") || undefined,
    facility_id: formData.get("facility_id") || undefined,
    name: formData.get("name"),
  });

  const supabase = await createClient();
  const { error } = await supabase.from("cleaning_tasks").insert(parsed);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/cleaning");
}

export async function assignCleaning(taskId: string, weekStartDate: string, studentId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_assignments")
    .upsert(
      { task_id: taskId, week_start_date: weekStartDate, student_id: studentId, status: "pending" },
      { onConflict: "task_id,week_start_date" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/cleaning");
}

export async function setCleaningStatus(assignmentId: string, status: "pending" | "done" | "missed") {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_assignments")
    .update({ status, verified_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/cleaning");
}
