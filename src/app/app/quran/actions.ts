"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";

const wirdSchema = z.object({
  record_date: z.string(),
  range_description: z.string().optional(),
  pages: z.coerce.number().optional(),
  memorization: z.coerce.boolean().optional(),
  note: z.string().optional(),
});

export async function logWird(formData: FormData) {
  const user = await requireUser();
  const parsed = wirdSchema.parse({
    record_date: formData.get("record_date"),
    range_description: formData.get("range_description") || undefined,
    pages: formData.get("pages") || undefined,
    memorization: formData.get("memorization") === "on",
    note: formData.get("note") || undefined,
  });

  const supabase = await createClient();
  const { error } = await supabase.from("quran_wird_logs").upsert(
    {
      student_id: user.id,
      record_date: parsed.record_date,
      range_description: parsed.range_description ?? null,
      pages: parsed.pages ?? null,
      memorization: parsed.memorization ?? false,
      note: parsed.note ?? null,
    },
    { onConflict: "student_id,record_date" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/app");
  revalidatePath("/app/quran");
}
