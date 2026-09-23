"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";

export async function markNotificationRead(notificationId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_reads")
    .upsert({ notification_id: notificationId, profile_id: user.id }, { onConflict: "notification_id,profile_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/app/notifications");
}
