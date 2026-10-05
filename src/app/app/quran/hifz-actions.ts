"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

const surahs = z.array(z.number().int().min(1).max(114)).min(1).max(114);
const status = z.enum(["memorized", "learning"]).nullable();

/** يضبط حالة سورة أو أكثر: محفوظة، أحفظها الآن، أو null للإزالة */
export async function setHifzStatus(input: { surahs: number[]; status: "memorized" | "learning" | null }) {
  return runAction(async () => {
    const user = await requireUser();
    const list = [...new Set(surahs.parse(input.surahs))];
    const st = status.parse(input.status);
    const supabase = await createClient();

    if (st === null) {
      const { error } = await supabase.from("quran_hifz").delete().eq("student_id", user.id).in("surah", list);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("quran_hifz")
        .upsert(
          list.map((surah) => ({ student_id: user.id, surah, status: st, updated_at: new Date().toISOString() })),
          { onConflict: "student_id,surah" }
        );
      if (error) throw new Error(error.message);
    }
    revalidatePath("/app/quran");
  });
}

export async function setReviewPages(pages: number | null) {
  return runAction(async () => {
    await requireUser();
    const v = z.number().int().min(1).max(60).nullable().parse(pages);
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_quran_review", { p_pages: v });
    if (error) throw new Error(error.message);
    revalidatePath("/app/quran");
  });
}

/** «راجعتها»: يتقدّم موضع المراجعة على صفحات المحفوظ */
export async function markReviewDone(totalPages: number) {
  return runAction(async () => {
    await requireUser();
    const total = z.number().int().min(1).max(604).parse(totalPages);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("quran_review_done", { p_total: total });
    if (error) throw new Error(error.message);
    revalidatePath("/app/quran");
    return { cursor: data };
  });
}
