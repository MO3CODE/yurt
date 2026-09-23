"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/current-user";

const schema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  body: z.string().min(1, "المحتوى مطلوب"),
  target_type: z.enum(["all", "apartment", "student", "role"]),
  target_apartment_id: z.string().optional(),
  target_student_id: z.string().optional(),
  target_role: z.string().optional(),
});

export async function createNotification(formData: FormData) {
  const user = await requireAdmin();
  const parsed = schema.parse({
    title: formData.get("title"),
    body: formData.get("body"),
    target_type: formData.get("target_type"),
    target_apartment_id: formData.get("target_apartment_id") || undefined,
    target_student_id: formData.get("target_student_id") || undefined,
    target_role: formData.get("target_role") || undefined,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("notifications").insert({
    title: parsed.title,
    body: parsed.body,
    target_type: parsed.target_type,
    target_apartment_id: parsed.target_type === "apartment" ? parsed.target_apartment_id : null,
    target_student_id: parsed.target_type === "student" ? parsed.target_student_id : null,
    target_role: parsed.target_type === "role" ? (parsed.target_role as "super_admin" | "admin" | "student") : null,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/notifications");
}
