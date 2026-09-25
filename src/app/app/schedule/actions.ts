"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";

const scheduleSchema = z.object({
  day_of_week: z.coerce.number().int().min(0).max(6),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  course_name: z.string().min(1, "اسم المادة مطلوب"),
  location: z.string().optional(),
});

export async function addScheduleEntry(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = scheduleSchema.parse({
      day_of_week: formData.get("day_of_week"),
      start_time: formData.get("start_time"),
      end_time: formData.get("end_time"),
      course_name: formData.get("course_name"),
      location: formData.get("location") || undefined,
    });

    const supabase = await createClient();
    const { error } = await supabase.from("class_schedule_entries").insert({
      student_id: user.id,
      ...parsed,
      location: parsed.location ?? null,
    });

    if (error) throw new Error(error.message);
    revalidatePath("/app/schedule");
    revalidatePath("/app");
  });
}

export async function deleteScheduleEntry(entryId: string) {
  return runAction(async () => {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("class_schedule_entries").delete().eq("id", entryId);
    if (error) throw new Error(error.message);
    revalidatePath("/app/schedule");
    revalidatePath("/app");
  });
}
