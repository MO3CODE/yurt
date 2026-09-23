"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/current-user";

const schema = z.object({
  status: z.enum(["open", "assigned", "in_progress", "resolved", "closed"]),
  assigned_to_name: z.string().optional(),
  admin_notes: z.string().optional(),
});

export async function updateAcademicSupportRequest(requestId: string, formData: FormData) {
  await requireAdmin();
  const parsed = schema.parse({
    status: formData.get("status"),
    assigned_to_name: formData.get("assigned_to_name") || undefined,
    admin_notes: formData.get("admin_notes") || undefined,
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("academic_support_requests")
    .update({
      ...parsed,
      resolved_at: parsed.status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", requestId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/academic-support");
}
