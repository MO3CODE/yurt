"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/current-user";

const updateSchema = z.object({
  status: z.enum(["new", "triaged", "in_progress", "escalated", "resolved", "rejected"]),
  admin_response: z.string().optional(),
});

export async function updateComplaint(complaintId: string, formData: FormData) {
  return runAction(async () => {
    await assertPermission("complaints");
    const parsed = updateSchema.parse({
      status: formData.get("status"),
      admin_response: formData.get("admin_response") || undefined,
    });

    const supabase = await createClient();
    const { error } = await supabase
      .from("complaints")
      .update({
        status: parsed.status,
        admin_response: parsed.admin_response,
        resolved_at: parsed.status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", complaintId);

    if (error) throw new Error(error.message);
    revalidatePath("/admin/complaints");
  });
}
