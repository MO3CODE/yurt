"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";

const schema = z.object({
  full_name: z.string().min(1, "الاسم مطلوب"),
  phone: z.string().optional(),
});

export async function updateProfile(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = schema.parse({
      full_name: formData.get("full_name"),
      phone: formData.get("phone") || undefined,
    });

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.full_name, phone: parsed.phone ?? null })
      .eq("id", user.id);

    if (error) throw new Error(error.message);
    revalidatePath("/profile");
  });
}
