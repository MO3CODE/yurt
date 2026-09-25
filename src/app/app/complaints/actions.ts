"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";

const complaintSchema = z.object({
  category: z.enum(["complaint", "suggestion"]),
  subject: z.string().min(1, "العنوان مطلوب"),
  description: z.string().min(1, "التفاصيل مطلوبة"),
});

export async function submitComplaint(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = complaintSchema.parse({
      category: formData.get("category"),
      subject: formData.get("subject"),
      description: formData.get("description"),
    });

    const supabase = await createClient();
    const { error } = await supabase.from("complaints").insert({
      student_id: user.id,
      apartment_id: user.apartmentId,
      ...parsed,
    });

    if (error) throw new Error(error.message);
    revalidatePath("/app/complaints");
  });
}
