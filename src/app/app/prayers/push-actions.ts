"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pushConfigured, sendPush } from "@/lib/push";
import { LEAD_OPTIONS, NUDGE_OPTIONS } from "@/lib/prayer-reminders";
import { FIVE_PRAYERS } from "@/lib/prayer-times";

const base64url = z.string().min(8).max(512).regex(/^[A-Za-z0-9_\-+/=]+$/, "مفتاح اشتراك غير صالح");
const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).startsWith("https://", "عنوان الاشتراك غير آمن"),
  keys: z.object({ p256dh: base64url, auth: base64url }),
});

/** يحفظ اشتراك هذا الجهاز. إن كان الجهاز مسجّلاً لحساب آخر ينتقل للحساب الحالي (تبديل الحسابات على جهاز واحد). */
export async function savePushSubscription(input: z.input<typeof subscriptionSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const v = subscriptionSchema.parse(input);
    // service role: صف الجهاز قد يكون مملوكاً لحساب سابق فلا تسمح RLS للحساب الجديد بتعديله
    const admin = createAdminClient();
    const { error } = await admin
      .from("push_subscriptions")
      .upsert({ profile_id: user.id, endpoint: v.endpoint, p256dh: v.keys.p256dh, auth_key: v.keys.auth }, { onConflict: "endpoint" });
    if (error) throw new Error(error.message);
  });
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("push_subscriptions").delete().eq("profile_id", user.id).eq("endpoint", z.string().url().parse(endpoint));
    if (error) throw new Error(error.message);
  });
}

const settingsSchema = z.object({
  leadMinutes: z.number().refine((n) => (LEAD_OPTIONS as readonly number[]).includes(n), "قيمة غير مسموحة"),
  nudgeMinutes: z
    .number()
    .refine((n) => (NUDGE_OPTIONS as readonly number[]).includes(n), "قيمة غير مسموحة")
    .nullable(),
  prayers: z.array(z.enum(FIVE_PRAYERS as [string, ...string[]])).max(5),
});

export async function savePrayerReminderSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const v = settingsSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("prayer_reminder_settings").upsert(
      {
        profile_id: user.id,
        enabled: true,
        lead_minutes: v.leadMinutes,
        nudge_minutes: v.nudgeMinutes,
        prayers: [...new Set(v.prayers)],
      },
      { onConflict: "profile_id" }
    );
    if (error) throw new Error(error.message);
  });
}

/** إشعار تجريبي فوري لكل أجهزة المستخدم، ليتأكد أن التذكيرات ستصله */
export async function sendTestPush(): Promise<ActionResult<{ sent: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    if (!pushConfigured()) throw new Error("الإشعارات غير مفعَّلة على الخادم بعد");

    const supabase = await createClient();
    const { data: subs, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth_key").eq("profile_id", user.id);
    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) throw new Error("فعّل التذكيرات على هذا الجهاز أولاً");

    const res = await sendPush(subs, { title: "إشعار تجريبي ✅", body: "ستصلك تذكيرات الصلاة على هذا الجهاز بإذن الله.", url: "/app/prayers", tag: "prayer-test" }, 120);
    if (res.goneIds.length > 0) await createAdminClient().from("push_subscriptions").delete().in("id", res.goneIds);
    if (res.sent === 0) throw new Error("تعذّر الإرسال لأي جهاز — أعد تفعيل التذكيرات ثم جرّب");
    return { sent: res.sent };
  });
}
