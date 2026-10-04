"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";

const complaintSchema = z
  .object({
    // «academic» طلب دعم أكاديمي: يُحفظ في جدول الدعم الأكاديمي لا الشكاوى
    category: z.enum(["complaint", "suggestion", "academic"]),
    subject: z.string().trim().min(1, "العنوان مطلوب").max(200),
    description: z.string().trim().max(4000),
  })
  .refine((v) => v.category === "academic" || v.description.length > 0, { message: "التفاصيل مطلوبة", path: ["description"] });

export async function submitComplaint(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = complaintSchema.parse({
      category: formData.get("category"),
      subject: formData.get("subject"),
      description: formData.get("description") ?? "",
    });

    const supabase = await createClient();

    if (parsed.category === "academic") {
      const { error: supportError } = await supabase.from("academic_support_requests").insert({
        student_id: user.id,
        subject: parsed.subject,
        description: parsed.description || null,
      });
      if (supportError) throw new Error(supportError.message);
      revalidatePath("/app/academic-support");
      revalidatePath("/admin/academic-support");
      return;
    }

    const { error } = await supabase.from("complaints").insert({
      student_id: user.id,
      apartment_id: user.apartmentId,
      category: parsed.category,
      subject: parsed.subject,
      description: parsed.description,
    });

    if (error) throw new Error(error.message);
    revalidatePath("/app/complaints");
  });
}
