import data from "./adhkar.json";
import { toInstant, type DayTimes } from "@/lib/prayer-times";
import { arNum } from "@/lib/quran";

// أذكار الصباح والمساء من حصن المسلم، مولّدة عبر npm run build:adhkar
export type AdhkarPeriod = "morning" | "evening";
export const ADHKAR_PERIODS: AdhkarPeriod[] = ["morning", "evening"];

export type Dhikr = {
  id: number;
  period: "both" | AdhkarPeriod;
  count: number;
  /** نص الذكر (null للأذكار القرآنية) */
  text: string | null;
  quran: {
    intro: string | null;
    title: string;
    basmala: boolean;
    ayas: { s: number; a: number; t: string }[];
  } | null;
  fadl: string | null;
  source: string | null;
};

const ALL = data as Dhikr[];

export function adhkarFor(period: AdhkarPeriod): Dhikr[] {
  return ALL.filter((d) => d.period === "both" || d.period === period);
}

export const PERIOD_LABELS: Record<AdhkarPeriod, string> = {
  morning: "أذكار الصباح",
  evening: "أذكار المساء",
};

/** الصباح من الفجر إلى العصر، والمساء من العصر إلى فجر اليوم التالي */
export function currentPeriod(now: Date, today: DayTimes): AdhkarPeriod {
  const t = now.getTime();
  const fajr = toInstant(today.day, today.fajr).getTime();
  const asr = toInstant(today.day, today.asr).getTime();
  return t >= fajr && t < asr ? "morning" : "evening";
}

/** يوم الأذكار: ما بعد منتصف الليل وقبل الفجر يُحسب من مساء اليوم السابق */
export function adhkarDay(now: Date, today: DayTimes, yesterday: string): string {
  return now.getTime() < toInstant(today.day, today.fajr).getTime() ? yesterday : today.day;
}

/** «مرة واحدة»، «مرتان»، «٣ مرات»، «١٠٠ مرة» */
export function countLabel(n: number): string {
  if (n === 1) return "مرة واحدة";
  if (n === 2) return "مرتان";
  if (n <= 10) return `${arNum(n)} مرات`;
  return `${arNum(n)} مرة`;
}
