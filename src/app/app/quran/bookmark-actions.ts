"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { QURAN_PAGES } from "@/lib/quran";

const ayaSchema = z.object({
  surah: z.number().int().min(1).max(114),
  aya: z.number().int().min(1).max(286),
  page: z.number().int().min(1).max(QURAN_PAGES),
});

/** يحفظ الآية في العلامات أو يزيلها إن كانت محفوظة؛ يرجع الحالة الجديدة */
export async function toggleBookmark(input: z.input<typeof ayaSchema>) {
  return runAction(async () => {
    const user = await requireUser();
    const v = ayaSchema.parse(input);
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("quran_bookmarks")
      .select("id")
      .eq("student_id", user.id)
      .eq("surah", v.surah)
      .eq("aya", v.aya)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("quran_bookmarks").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("quran_bookmarks").insert({ student_id: user.id, ...v });
      if (error) throw new Error(error.message);
    }
    revalidatePath("/app/quran/search");
    return { saved: !existing };
  });
}

export async function updateBookmarkNote(id: string, note: string) {
  return runAction(async () => {
    await requireUser();
    const clean = z.string().max(500, "الملاحظة أطول من ٥٠٠ حرف").parse(note).trim();
    const supabase = await createClient();
    // RLS تقصر التعديل على علامات الطالب نفسه
    const { error } = await supabase.from("quran_bookmarks").update({ note: clean || null }).eq("id", z.string().uuid().parse(id));
    if (error) throw new Error(error.message);
    revalidatePath("/app/quran/search");
  });
}

export async function deleteBookmark(id: string) {
  return runAction(async () => {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("quran_bookmarks").delete().eq("id", z.string().uuid().parse(id));
    if (error) throw new Error(error.message);
    revalidatePath("/app/quran/search");
  });
}
