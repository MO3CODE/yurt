import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysISO, todayISO } from "@/lib/date";
import { FIVE_PRAYERS, istanbulHM, type DayTimes, type FivePrayer } from "@/lib/prayer-times";
import { getDayTimesMap, syncOfficialTimes } from "@/lib/prayer-times-server";
import {
  DEFAULT_REMINDER_SETTINGS,
  planReminders,
  reminderMessage,
  type ReminderSettings,
} from "@/lib/prayer-reminders";
import { pushConfigured, sendPush, type PushTarget } from "@/lib/push";
import {
  DEFAULT_DEVOTION_SETTINGS,
  devotionMessage,
  planDevotionReminders,
  type DevotionKind,
  type DevotionSettings,
} from "@/lib/devotion-reminders";

// يستدعيه pg_cron في قاعدة البيانات كل دقيقة (انظر migration 0012)
export const maxDuration = 30;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function toSettings(row: {
  enabled: boolean;
  lead_minutes: number;
  nudge_minutes: number | null;
  prayers: string[];
} | undefined): ReminderSettings {
  if (!row) return DEFAULT_REMINDER_SETTINGS;
  return {
    enabled: row.enabled,
    leadMinutes: row.lead_minutes,
    nudgeMinutes: row.nudge_minutes,
    prayers: row.prayers.filter((p): p is FivePrayer => (FIVE_PRAYERS as string[]).includes(p)),
  };
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  // dryRun يخطّط ولا يسجّل ولا يرسل (للفحص)؛ ويسمح بتجربة وقت آخر عبر now؛ و sync يفرض مزامنة الجدول الرسمي الآن
  let body: { dryRun?: boolean; now?: string; sync?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // الجسم اختياري
  }
  const dryRun = body.dryRun === true;
  const now = dryRun && body.now ? new Date(body.now) : new Date();
  if (Number.isNaN(now.getTime())) return Response.json({ error: "now غير صالح" }, { status: 400 });

  const admin = createAdminClient();
  const today = todayISO(now);
  const summary = {
    at: now.toISOString(),
    dryRun,
    sync: null as null | { upserted: number; rejected: number; error?: string },
    subscribers: 0,
    planned: 0,
    sent: 0,
    failed: 0,
    removedSubscriptions: 0,
    retryable: 0,
    plan: [] as { profileId: string; prayer: string; kind: string }[],
    devotionPlanned: 0,
    devotionPlan: [] as { profileId: string; kind: string }[],
  };

  // ---- ١) مزامنة الجدول الرسمي: يومياً 00:10 بتوقيت إسطنبول، أو كل ربع ساعة إن نقص الجدول
  if (!dryRun) {
    const { data: have } = await admin.from("prayer_times").select("day").gte("day", today).lte("day", addDaysISO(today, 6));
    const missing = (have?.length ?? 0) < 7;
    if (body.sync === true || istanbulHM(now) === "00:10" || (missing && now.getUTCMinutes() % 15 === 0)) {
      summary.sync = await syncOfficialTimes(admin);
    }
  }

  // ---- ٢) المشتركون في الإشعارات
  const { data: subs, error: subsError } = await admin.from("push_subscriptions").select("id, profile_id, endpoint, p256dh, auth_key");
  if (subsError) return Response.json({ ...summary, error: subsError.message }, { status: 500 });
  if (!subs || subs.length === 0) return Response.json(summary);
  summary.subscribers = new Set(subs.map((s) => s.profile_id)).size;

  const profileIds = [...new Set(subs.map((s) => s.profile_id))];
  const [timesMap, { data: settingsRows }, { data: records }, { data: logRows }] = await Promise.all([
    getDayTimesMap(admin, [today]),
    admin.from("prayer_reminder_settings").select("profile_id, enabled, lead_minutes, nudge_minutes, prayers").in("profile_id", profileIds),
    admin.from("prayer_records").select("student_id, prayer").eq("record_date", today).in("student_id", profileIds),
    admin.from("prayer_push_log").select("profile_id, prayer, kind").eq("day", today).in("profile_id", profileIds),
  ]);
  const todayTimes = timesMap.get(today)!;
  const settingsBy = new Map((settingsRows ?? []).map((r) => [r.profile_id, toSettings(r)]));

  const planned = planReminders({
    now,
    today: todayTimes,
    users: profileIds.map((profileId) => ({ profileId, settings: settingsBy.get(profileId) ?? DEFAULT_REMINDER_SETTINGS })),
    logged: new Set((records ?? []).map((r) => `${r.student_id}:${r.prayer}`)),
    sent: new Set((logRows ?? []).map((r) => `${r.profile_id}:${r.prayer}:${r.kind}`)),
  });
  summary.planned = planned.length;
  summary.plan = planned.map((p) => ({ profileId: p.profileId, prayer: p.prayer, kind: p.kind }));

  // ---- تذكيرات الأذكار والورد (للطلاب فقط). استعلامات مستقلة حتى لا يؤثر أي خلل فيها على تذكيرات الصلاة
  const devotion = await planDevotion(admin, now, todayTimes, today, profileIds);
  summary.devotionPlanned = devotion.planned.length;
  summary.devotionPlan = devotion.planned.map((p) => ({ profileId: p.profileId, kind: p.kind }));

  if ((planned.length === 0 && devotion.planned.length === 0) || dryRun) return Response.json(summary);

  if (!pushConfigured()) return Response.json({ ...summary, error: "مفاتيح VAPID غير مضبوطة" }, { status: 500 });

  // ---- ٣) نسجّل أولاً: المفتاح الأساسي يضمن أن كل إشعار يُرسَل مرة واحدة حتى لو تداخل تشغيلان
  const { data: claimed, error: claimError } =
    planned.length > 0
      ? await admin
          .from("prayer_push_log")
          .upsert(
            planned.map((p) => ({ profile_id: p.profileId, prayer: p.prayer, kind: p.kind, day: p.day })),
            { onConflict: "profile_id,prayer,kind,day", ignoreDuplicates: true }
          )
          .select("profile_id, prayer, kind")
      : { data: [], error: null };
  if (claimError) return Response.json({ ...summary, error: claimError.message }, { status: 500 });

  const subsByProfile = new Map<string, PushTarget[]>();
  for (const s of subs) subsByProfile.set(s.profile_id, [...(subsByProfile.get(s.profile_id) ?? []), s]);

  // ---- ٤) الإرسال
  const goneIds = new Set<string>();
  await Promise.all(
    (claimed ?? []).map(async (c) => {
      const prayer = c.prayer as FivePrayer;
      const kind = c.kind as "adhan" | "nudge";
      const settings = settingsBy.get(c.profile_id) ?? DEFAULT_REMINDER_SETTINGS;
      const msg = reminderMessage(kind, prayer, settings.leadMinutes, todayTimes[prayer]);
      const res = await sendPush(subsByProfile.get(c.profile_id) ?? [], msg, kind === "adhan" ? 600 : 900);

      summary.sent += res.sent;
      summary.failed += res.failed;
      res.goneIds.forEach((id) => goneIds.add(id));

      // لم يصل لأي جهاز بسبب عطل مؤقت: نفكّ التسجيل ليُعاد المحاولة في الدقيقة التالية ضمن المهلة
      if (res.sent === 0 && res.failed > 0) {
        summary.retryable++;
        await admin.from("prayer_push_log").delete().match({ profile_id: c.profile_id, prayer, kind, day: today });
      }
    })
  );

  // ---- ٤ب) تذكيرات الأذكار والورد بنفس الطريقة: تسجيل ثم إرسال، وفكّ التسجيل عند عطل مؤقت
  if (devotion.planned.length > 0) {
    const { data: claimedDevotion, error: devotionError } = await admin
      .from("devotion_push_log")
      .upsert(
        devotion.planned.map((p) => ({ profile_id: p.profileId, kind: p.kind, day: p.day })),
        { onConflict: "profile_id,kind,day", ignoreDuplicates: true }
      )
      .select("profile_id, kind");
    if (devotionError) console.error("devotion_push_log", devotionError.message);

    await Promise.all(
      (claimedDevotion ?? []).map(async (c) => {
        const kind = c.kind as DevotionKind;
        const msg = devotionMessage(kind, devotion.wirdRemaining.get(c.profile_id) ?? null);
        const res = await sendPush(subsByProfile.get(c.profile_id) ?? [], msg, 1800);

        summary.sent += res.sent;
        summary.failed += res.failed;
        res.goneIds.forEach((id) => goneIds.add(id));
        if (res.sent === 0 && res.failed > 0) {
          summary.retryable++;
          await admin.from("devotion_push_log").delete().match({ profile_id: c.profile_id, kind, day: today });
        }
      })
    );
  }

  if (goneIds.size > 0) {
    await admin.from("push_subscriptions").delete().in("id", [...goneIds]);
    summary.removedSubscriptions = goneIds.size;
  }

  // ---- ٥) تنظيف سجل الإرسال القديم (مرة يومياً قرابة 03:00)
  if (istanbulHM(now) === "03:00") {
    await admin.from("prayer_push_log").delete().lt("day", addDaysISO(today, -7));
    await admin.from("devotion_push_log").delete().lt("day", addDaysISO(today, -7));
  }

  return Response.json(summary);
}

type Admin = ReturnType<typeof createAdminClient>;

/** يخطّط تذكيرات الأذكار والورد لطلاب المشتركين؛ أي خطأ هنا يعطّلها وحدها ويُسجَّل */
async function planDevotion(admin: Admin, now: Date, todayTimes: DayTimes, today: string, profileIds: string[]) {
  const empty = { planned: [] as ReturnType<typeof planDevotionReminders>, wirdRemaining: new Map<string, number | null>() };
  const [students, settings, adhkar, platform, logs, progress, sentRows] = await Promise.all([
    admin.from("students").select("id").in("id", profileIds),
    admin
      .from("prayer_reminder_settings")
      .select("profile_id, adhkar_morning_minutes, adhkar_evening_minutes, wird_prayer, wird_minutes")
      .in("profile_id", profileIds),
    admin.from("adhkar_logs").select("student_id, period").eq("record_date", today).in("student_id", profileIds),
    admin.from("quran_platform_daily").select("student_id, pages").eq("record_date", today).in("student_id", profileIds),
    admin.from("quran_wird_logs").select("student_id, pages").eq("record_date", today).in("student_id", profileIds),
    admin.from("quran_progress").select("student_id, daily_goal").in("student_id", profileIds),
    admin.from("devotion_push_log").select("profile_id, kind").eq("day", today).in("profile_id", profileIds),
  ]);
  const failed = [students, settings, adhkar, platform, logs, progress, sentRows].find((r) => r.error);
  if (failed?.error) {
    console.error("devotion reminders", failed.error.message);
    return empty;
  }

  const settingsBy = new Map(
    (settings.data ?? []).map((r): [string, DevotionSettings] => [
      r.profile_id,
      {
        morningMinutes: r.adhkar_morning_minutes,
        eveningMinutes: r.adhkar_evening_minutes,
        wirdPrayer: (FIVE_PRAYERS as string[]).includes(r.wird_prayer ?? "") ? (r.wird_prayer as FivePrayer) : null,
        wirdMinutes: r.wird_minutes,
      },
    ])
  );

  const pagesToday = new Map<string, number>();
  const add = (id: string, n: number) => pagesToday.set(id, (pagesToday.get(id) ?? 0) + n);
  for (const r of platform.data ?? []) if (r.student_id) add(r.student_id, r.pages ?? 0);
  for (const r of logs.data ?? []) add(r.student_id, Number(r.pages ?? 0));
  const loggedWird = new Set<string>();
  for (const r of platform.data ?? []) if (r.student_id) loggedWird.add(r.student_id);
  for (const r of logs.data ?? []) loggedWird.add(r.student_id);
  const goalBy = new Map((progress.data ?? []).map((p) => [p.student_id, p.daily_goal]));

  const studentIds = (students.data ?? []).map((s) => s.id);
  const wirdRemaining = new Map<string, number | null>();
  for (const id of studentIds) {
    const goal = goalBy.get(id);
    // بهدف: المتبقي منه. بلا هدف: أي قراءة اليوم تكفي (٠)، وإلا null
    wirdRemaining.set(id, goal ? Math.max(0, Math.ceil(goal - (pagesToday.get(id) ?? 0))) : loggedWird.has(id) ? 0 : null);
  }

  const planned = planDevotionReminders({
    now,
    today: todayTimes,
    users: studentIds.map((profileId) => ({ profileId, settings: settingsBy.get(profileId) ?? DEFAULT_DEVOTION_SETTINGS })),
    adhkarDone: new Set((adhkar.data ?? []).map((r) => r.student_id + ":" + r.period)),
    wirdRemaining,
    sent: new Set((sentRows.data ?? []).map((r) => r.profile_id + ":" + r.kind)),
  });
  return { planned, wirdRemaining };
}
