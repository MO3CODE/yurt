"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/auth/current-user";

const facilitySchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  facility_type: z.string().optional(),
  floor_number: z.coerce.number().optional(),
});

export async function createFacility(formData: FormData) {
  return runAction(async () => {
    await requireAdmin();
    const parsed = facilitySchema.parse({
      name: formData.get("name"),
      facility_type: formData.get("facility_type") || undefined,
      floor_number: formData.get("floor_number") || undefined,
    });

    const supabase = await createClient();
    const { error } = await supabase.from("facilities").insert(parsed);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/facilities");
  });
}

const issueSchema = z.object({
  facility_id: z.string().uuid(),
  description: z.string().min(1, "الوصف مطلوب"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

export async function reportFacilityIssue(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = issueSchema.parse({
      facility_id: formData.get("facility_id"),
      description: formData.get("description"),
      priority: formData.get("priority"),
    });

    const supabase = await createClient();
    const { error } = await supabase.from("facility_issues").insert({ ...parsed, reported_by: user.id });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/facilities");
  });
}

export async function resolveFacilityIssue(issueId: string) {
  return runAction(async () => {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("facility_issues")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", issueId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/facilities");
  });
}
