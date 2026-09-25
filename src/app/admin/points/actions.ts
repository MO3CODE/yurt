"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/current-user";

const schema = z.object({
  student_id: z.string().uuid(),
  category: z.enum(["prayer", "quran", "attendance", "cleaning", "academic", "other"]),
  points: z.coerce.number().int(),
  reason: z.string().optional(),
});

export async function awardPoints(formData: FormData) {
  return runAction(async () => {
    const user = await assertPermission("points");
    const parsed = schema.parse({
      student_id: formData.get("student_id"),
      category: formData.get("category"),
      points: formData.get("points"),
      reason: formData.get("reason") || undefined,
    });

    const supabase = await createClient();
    const { error } = await supabase.from("points_entries").insert({ ...parsed, created_by: user.id });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/points");
  });
}
