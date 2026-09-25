"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import type { AttendanceStatus } from "@/lib/supabase/types";

export async function logAttendance(recordDate: string, status: AttendanceStatus, note?: string) {
  return runAction(async () => {
    const user = await requireUser();
    const supabase = await createClient();

    const { error } = await supabase.from("attendance_records").upsert(
      {
        student_id: user.id,
        record_date: recordDate,
        status,
        source: "self",
        note: note || null,
      },
      { onConflict: "student_id,record_date" }
    );

    if (error) throw new Error(error.message);
    revalidatePath("/app");
    revalidatePath("/app/attendance");
  });
}
