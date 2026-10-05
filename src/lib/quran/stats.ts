import { addDaysISO } from "@/lib/date";

// إحصائيات الورد: الأيام المكتملة والسلسلة (بنفس قاعدة النقاط في award_quran_points)
export type DayTotal = { pages: number; logged: boolean };

/** يوم مكتمل: بهدف = بلغه (منصة + ورقي)، بلا هدف = أي قراءة */
export function dayComplete(t: DayTotal | undefined, goal: number | null): boolean {
  if (!t) return false;
  return goal ? t.pages >= goal : t.logged || t.pages > 0;
}

export function buildTotals(
  platform: { record_date: string | null; pages: number | null }[],
  logs: { record_date: string; pages: number | null }[]
): Map<string, DayTotal> {
  const map = new Map<string, DayTotal>();
  const add = (date: string, pages: number) => {
    const t = map.get(date) ?? { pages: 0, logged: false };
    map.set(date, { pages: t.pages + pages, logged: true });
  };
  for (const r of platform) if (r.record_date) add(r.record_date, r.pages ?? 0);
  for (const r of logs) add(r.record_date, Number(r.pages ?? 0));
  return map;
}

/**
 * السلسلة الحالية: إن اكتمل اليوم تُعدّ منه، وإلا من أمس (لم تنقطع بعد ما دام اليوم لم ينتهِ).
 * أطول سلسلة: ضمن الفترة المتاحة (days يوماً).
 */
export function streaks(totals: Map<string, DayTotal>, today: string, goal: number | null, days = 365) {
  const todayDone = dayComplete(totals.get(today), goal);
  let current = 0;
  for (let d = todayDone ? today : addDaysISO(today, -1); dayComplete(totals.get(d), goal); d = addDaysISO(d, -1)) current++;

  let best = 0;
  let run = 0;
  for (let i = days - 1; i >= 0; i--) {
    if (dayComplete(totals.get(addDaysISO(today, -i)), goal)) best = Math.max(best, ++run);
    else run = 0;
  }
  return { current, best: Math.max(best, current), todayDone };
}
