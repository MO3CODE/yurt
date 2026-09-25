"use server";

import { runAction } from "@/lib/action-result";
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
  target_role: z.enum(["super_admin", "admin", "student"]).optional(),
})
  // بدون هذا يُحفظ إشعار بلا مستهدف فلا يصل لأحد
  .superRefine((v, ctx) => {
    if (v.target_type === "apartment" && !v.target_apartment_id)
      ctx.addIssue({ code: "custom", message: "اختر الشقة المستهدفة", path: ["target_apartment_id"] });
    if (v.target_type === "student" && !v.target_student_id)
      ctx.addIssue({ code: "custom", message: "اختر الطالب المستهدف", path: ["target_student_id"] });
    if (v.target_type === "role" && !v.target_role)
      ctx.addIssue({ code: "custom", message: "اختر الفئة المستهدفة", path: ["target_role"] });
  });

export async function createNotification(formData: FormData) {
  return runAction(async () => {
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
      target_role: parsed.target_type === "role" ? parsed.target_role : null,
      created_by: user.id,
    });

    if (error) throw new Error(error.message);
    revalidatePath("/admin/notifications");
  });
}
