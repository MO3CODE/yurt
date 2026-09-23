"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import type { PrayerName, PrayerStatus } from "@/lib/supabase/types";

export async function logPrayer(recordDate: string, prayer: PrayerName, status: PrayerStatus) {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("prayer_records")
    .upsert(
      { student_id: user.id, record_date: recordDate, prayer, status },
      { onConflict: "student_id,record_date,prayer" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/app");
  revalidatePath("/app/prayers");
}
