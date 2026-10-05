"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { getDayTimesMap } from "@/lib/prayer-times-server";
import { addDaysISO, todayISO } from "@/lib/date";
import { adhkarDay } from "@/lib/adhkar";

const schema = z.object({
  period: z.enum(["morning", "evening"]),
  method: z.enum(["counter", "manual"]),
});

/** يسجّل إتمام أذكار الصباح أو المساء ليومها (المساء بعد منتصف الليل يتبع اليوم السابق) */
export async function completeAdhkar(input: z.input<typeof schema>) {
  return runAction(async () => {
    const user = await requireUser();
    const { period, method } = schema.parse(input);
    const supabase = await createClient();

    const now = new Date();
    const today = todayISO(now);
    const times = (await getDayTimesMap(supabase, [today])).get(today)!;
    const day = adhkarDay(now, times, addDaysISO(today, -1));
    if (period === "morning" && day !== today) throw new Error("وقت أذكار الصباح يبدأ بعد الفجر");

    const { error } = await supabase
      .from("adhkar_logs")
      .upsert({ student_id: user.id, record_date: day, period, method }, { onConflict: "student_id,record_date,period", ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    revalidatePath("/app");
    revalidatePath("/app/adhkar");
  });
}
