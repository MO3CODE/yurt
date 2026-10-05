// تذكيرات أذكار الصباح والمساء والورد — دالة نقية مثل تذكيرات الصلاة (انظر prayer-reminders.ts)
import { GRACE_MINUTES, type ReminderMessage } from "@/lib/prayer-reminders";
import { TIMED_LABELS, toInstant, type DayTimes, type FivePrayer } from "@/lib/prayer-times";
import { pagesLabel } from "@/lib/quran";

export const ADHKAR_OFFSETS = [10, 15, 20, 30, 45] as const;
export const WIRD_OFFSETS = [0, 15, 30, 60, 90] as const;

export type DevotionKind = "adhkar_morning" | "adhkar_evening" | "wird";

export type DevotionSettings = {
  /** دقائق بعد الفجر (null = موقوف) */
  morningMinutes: number | null;
  /** دقائق بعد العصر (null = موقوف) */
  eveningMinutes: number | null;
  /** الصلاة التي يأتي بعدها تذكير الورد (null = موقوف) */
  wirdPrayer: FivePrayer | null;
  wirdMinutes: number;
};

export const DEFAULT_DEVOTION_SETTINGS: DevotionSettings = {
  morningMinutes: 15,
  eveningMinutes: 15,
  wirdPrayer: "isha",
  wirdMinutes: 30,
};

export type PlannedDevotion = { profileId: string; kind: DevotionKind; day: string };

export function planDevotionReminders(input: {
  now: Date;
  today: DayTimes;
  users: { profileId: string; settings: DevotionSettings }[];
  /** `${profileId}:morning|evening` — أذكار أتمّها الطالب اليوم */
  adhkarDone: Set<string>;
  /** الصفحات المتبقية من ورد اليوم: ٠ = أتمّه، null = بلا هدف ولم يقرأ شيئاً */
  wirdRemaining: Map<string, number | null>;
  /** `${profileId}:${kind}` — ما أُرسل اليوم مسبقاً */
  sent: Set<string>;
}): PlannedDevotion[] {
  const { now, today, users, adhkarDone, wirdRemaining, sent } = input;
  const nowMs = now.getTime();
  const graceMs = GRACE_MINUTES * 60_000;
  const at = (p: FivePrayer) => toInstant(today.day, today[p]).getTime();
  const endOfDay = toInstant(today.day, "23:59").getTime();

  const due = (base: number, minutes: number) => {
    const t = base + minutes * 60_000;
    return t <= nowMs && nowMs < Math.min(t + graceMs, endOfDay);
  };

  const out: PlannedDevotion[] = [];
  for (const { profileId, settings } of users) {
    const push = (kind: DevotionKind) => {
      if (!sent.has(`${profileId}:${kind}`)) out.push({ profileId, kind, day: today.day });
    };
    if (settings.morningMinutes !== null && !adhkarDone.has(`${profileId}:morning`) && due(at("fajr"), settings.morningMinutes)) {
      push("adhkar_morning");
    }
    if (settings.eveningMinutes !== null && !adhkarDone.has(`${profileId}:evening`) && due(at("asr"), settings.eveningMinutes)) {
      push("adhkar_evening");
    }
    if (settings.wirdPrayer !== null && wirdRemaining.get(profileId) !== 0 && due(at(settings.wirdPrayer), settings.wirdMinutes)) {
      push("wird");
    }
  }
  return out;
}

export function devotionMessage(kind: DevotionKind, wirdRemaining: number | null): ReminderMessage {
  switch (kind) {
    case "adhkar_morning":
      return { title: "حان وقت أذكار الصباح", body: "دقائق تحصّن بها يومك بإذن الله", tag: "adhkar-morning", url: "/app/adhkar" };
    case "adhkar_evening":
      return { title: "حان وقت أذكار المساء", body: "قبل غروب الشمس، دقائق تحصّن بها ليلتك", tag: "adhkar-evening", url: "/app/adhkar" };
    case "wird":
      return {
        title: "وردك اليومي",
        body: wirdRemaining ? `تبقّى لك ${pagesLabel(wirdRemaining)} من وردك اليوم` : "لم تقرأ وردك اليوم بعد",
        tag: "wird",
        url: "/app/quran/read",
      };
  }
}

export const WIRD_PRAYER_LABEL = (p: FivePrayer) => `بعد ${TIMED_LABELS[p]}`;
