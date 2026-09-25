"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { todayISO } from "@/lib/date";

const schema = z.object({
  condition_description: z.string().min(1, "الوصف مطلوب"),
  severity: z.enum(["mild", "moderate", "severe"]),
});

export async function reportHealthIssue(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = schema.parse({
      condition_description: formData.get("condition_description"),
      severity: formData.get("severity"),
    });

    const supabase = await createClient();
    const { error } = await supabase.from("health_records").insert({
      student_id: user.id,
      reported_by: user.id,
      condition_description: parsed.condition_description,
      severity: parsed.severity,
    });

    if (error) throw new Error(error.message);
    revalidatePath("/app/health");
  });
}

export async function markRecovered(recordId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("health_records")
      .update({ status: "recovered", end_date: todayISO() })
      .eq("id", recordId)
      .eq("student_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/app/health");
  });
}
