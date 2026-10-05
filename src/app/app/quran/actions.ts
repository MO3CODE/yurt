"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { QURAN_PAGES } from "@/lib/quran";
import { awardQuranPoints } from "@/lib/quran/points";

const wirdSchema = z.object({
  record_date: z.string(),
  range_description: z.string().optional(),
  pages: z.coerce.number().optional(),
  reached_page: z.coerce
    .number()
    .int("رقم الصفحة يجب أن يكون عدداً صحيحاً")
    .min(1, "رقم الصفحة بين ١ و٦٠٤")
    .max(QURAN_PAGES, "رقم الصفحة بين ١ و٦٠٤")
    .optional(),
  memorization: z.coerce.boolean().optional(),
  note: z.string().optional(),
});

export async function logWird(formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = wirdSchema.parse({
      record_date: formData.get("record_date"),
      range_description: formData.get("range_description") || undefined,
      pages: formData.get("pages") || undefined,
      reached_page: formData.get("reached_page") || undefined,
      memorization: formData.get("memorization") === "on",
      note: formData.get("note") || undefined,
    });

    const supabase = await createClient();
    const { data: previous } = await supabase
      .from("quran_wird_logs")
      .select("reached_page")
      .eq("student_id", user.id)
      .eq("record_date", parsed.record_date)
      .maybeSingle();

    const { error } = await supabase.from("quran_wird_logs").upsert(
      {
        student_id: user.id,
        record_date: parsed.record_date,
        range_description: parsed.range_description ?? null,
        pages: parsed.pages ?? null,
        reached_page: parsed.reached_page ?? null,
        memorization: parsed.memorization ?? false,
        note: parsed.note ?? null,
      },
      { onConflict: "student_id,record_date" }
    );
    if (error) throw new Error(error.message);

    // تحريك علامة الختمة فقط عند تغيّر الصفحة، حتى لا يُحسب حفظ النموذج مرتين ختمتين
    if (parsed.reached_page && parsed.reached_page !== previous?.reached_page) {
      const { error: progressError } = await supabase.rpc("set_quran_reached_page", { p_page: parsed.reached_page });
      if (progressError) throw new Error(progressError.message);
    }

    const points = await awardQuranPoints(supabase);
    revalidatePath("/app");
    revalidatePath("/app/quran");
    return { points };
  });
}

const planSchema = z.object({
  start: z.number().int().min(1, "صفحة البدء بين ١ و٦٠٤").max(QURAN_PAGES, "صفحة البدء بين ١ و٦٠٤").nullable(),
  dailyGoal: z
    .number()
    .int("الورد اليومي عدد صحيح من الصفحات")
    .min(1, "الورد اليومي صفحة على الأقل")
    .max(QURAN_PAGES, "الورد اليومي أكبر من المصحف")
    .nullable(),
});

/** خطة الورد: من أين تبدأ الختمة (null = العلامة كما هي) وكم صفحة يومياً */
export async function setQuranPlan(input: { start: number | null; dailyGoal: number | null }) {
  return runAction(async () => {
    const parsed = planSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_quran_plan", { p_start: parsed.start, p_daily_goal: parsed.dailyGoal });
    if (error) throw new Error(error.message);
    // هدف أقل قد يجعل اليوم مكتملاً
    await awardQuranPoints(supabase);
    revalidatePath("/app");
    revalidatePath("/app/quran");
  });
}

export type PageReadResult = {
  counted: boolean;
  khatma_completed: boolean;
  current_page: number;
  khatmas: number;
  today_pages: number;
  /** نقاط مُنحت الآن (إتمام الهدف، سلسلة، ختمة) */
  points: number;
};

/** يسجّل صفحة بقيت ظاهرة ٣٠ ثانية في القارئ؛ التحقق وحد الوقت والختمة كلها داخل الدالة في القاعدة */
export async function recordQuranPage(page: number) {
  return runAction(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("record_quran_page", { p_page: page });
    if (error) throw new Error(error.message);
    const result = data as Omit<PageReadResult, "points">;
    const points = result.counted || result.khatma_completed ? await awardQuranPoints(supabase) : 0;
    return { ...result, points };
  });
}
