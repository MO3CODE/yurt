"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";

const schema = z.object({
  subject: z.string().min(1, "المادة مطلوبة"),
  description: z.string().optional(),
});

export async function requestAcademicSupport(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = schema.parse({
      subject: formData.get("subject"),
      description: formData.get("description") || undefined,
    });

    const supabase = await createClient();
    const { error } = await supabase.from("academic_support_requests").insert({
      student_id: user.id,
      subject: parsed.subject,
      description: parsed.description ?? null,
    });

    if (error) throw new Error(error.message);
    revalidatePath("/app/academic-support");
  });
}
