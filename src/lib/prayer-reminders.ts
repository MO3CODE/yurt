// تخطيط تذكيرات الصلاة — دالة نقية: تُرجع ما يجب إرساله في هذه الدقيقة فقط.
// تُستدعى من مجدول يعمل كل دقيقة؛ المهلة تغطي تأخّر أي تشغيل، وسجل الإرسال يمنع التكرار.
import { FIVE_PRAYERS, PRAYER_PLACE, TIMED_LABELS, toInstant, type DayTimes, type FivePrayer } from "@/lib/prayer-times";

export const LEAD_OPTIONS = [0, 5, 10, 15, 30] as const;
export const NUDGE_OPTIONS = [20, 30, 45, 60] as const;

/** أقصى تأخّر مقبول لإرسال تذكير فاته موعده (مثلاً تعطّل المجدول دقائق) */
export const GRACE_MINUTES = 10;

export type ReminderKind = "adhan" | "nudge";

export type ReminderSettings = {
  enabled: boolean;
  /** دقائق قبل الأذان (٠ = عند الأذان) */
  leadMinutes: number;
  /** تذكير بتسجيل الصلاة بعد الأذان بكذا دقيقة إن لم تُسجَّل (null = معطّل) */
  nudgeMinutes: number | null;
  prayers: FivePrayer[];
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  leadMinutes: 0,
  nudgeMinutes: null,
  prayers: [...FIVE_PRAYERS],
};

export type PlannedReminder = { profileId: string; prayer: FivePrayer; kind: ReminderKind; day: string };

export function planReminders(input: {
  now: Date;
  today: DayTimes;
  users: { profileId: string; settings: ReminderSettings }[];
  /** `${profileId}:${prayer}` — صلوات سجّلها الطالب اليوم (أي حالة) */
  logged: Set<string>;
  /** `${profileId}:${prayer}:${kind}` — ما أُرسل اليوم مسبقاً */
  sent: Set<string>;
}): PlannedReminder[] {
  const { now, today, users, logged, sent } = input;
  const nowMs = now.getTime();
  const graceMs = GRACE_MINUTES * 60_000;
  const at = (p: FivePrayer) => toInstant(today.day, today[p]).getTime();

  // نهاية وقت كل صلاة: التذكير بالتسجيل لا معنى له بعد خروج الوقت
  const windowEnd: Record<FivePrayer, number> = {
    fajr: toInstant(today.day, today.sunrise).getTime(),
    dhuhr: at("asr"),
    asr: at("maghrib"),
    maghrib: at("isha"),
    isha: toInstant(today.day, "23:59").getTime(),
  };

  const out: PlannedReminder[] = [];
  for (const { profileId, settings } of users) {
    if (!settings.enabled) continue;
    for (const prayer of settings.prayers) {
      const base = at(prayer);

      const adhanAt = base - settings.leadMinutes * 60_000;
      if (adhanAt <= nowMs && nowMs < adhanAt + graceMs && !sent.has(`${profileId}:${prayer}:adhan`)) {
        out.push({ profileId, prayer, kind: "adhan", day: today.day });
      }

      if (settings.nudgeMinutes !== null) {
        const nudgeAt = base + settings.nudgeMinutes * 60_000;
        if (
          nudgeAt <= nowMs &&
          nowMs < Math.min(nudgeAt + graceMs, windowEnd[prayer]) &&
          !logged.has(`${profileId}:${prayer}`) &&
          !sent.has(`${profileId}:${prayer}:nudge`)
        ) {
          out.push({ profileId, prayer, kind: "nudge", day: today.day });
        }
      }
    }
  }
  return out;
}

export type ReminderMessage = { title: string; body: string; tag: string; url: string };

export function reminderMessage(kind: ReminderKind, prayer: FivePrayer, leadMinutes: number, hm: string): ReminderMessage {
  const label = TIMED_LABELS[prayer];
  const place = `${hm} — ${PRAYER_PLACE.label}`;
  const url = "/app/prayers";
  const tag = `prayer-${prayer}-${kind}`;

  if (kind === "nudge") {
    return { title: `هل صلّيت ${label}؟`, body: "لم تسجّل صلاتك بعد — افتح المنصة وسجّلها.", tag, url };
  }
  if (leadMinutes > 0) {
    return { title: `بعد ${leadMinutes} دقيقة: أذان ${label}`, body: place, tag, url };
  }
  return {
    title: `حان الآن وقت صلاة ${label}`,
    body: prayer === "fajr" ? `${place}. الصلاة خير من النوم` : `${place}. تقبّل الله طاعتك`,
    tag,
    url,
  };
}
