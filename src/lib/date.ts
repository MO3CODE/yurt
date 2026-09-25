// المنطقة الزمنية المرجعية للمنصة — عدّلها إذا احتجت
export const APP_TIMEZONE = "Europe/Istanbul";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
}

// كل الحسابات على تواريخ YYYY-MM-DD تتم بتوقيت UTC حتى لا تنزاح يوماً
// حسب المنطقة الزمنية للسيرفر (Vercel = UTC، الجهاز المحلي = +3)
export function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeekISO(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = الأحد
}

export function weekStartISO(date = todayISO()): string {
  return addDaysISO(date, -dayOfWeekISO(date));
}

export function monthStartISO(date = todayISO()): string {
  return `${date.slice(0, 7)}-01`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ar", {
    timeZone: APP_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export function dayName(dayOfWeek: number): string {
  return dayNames[dayOfWeek] ?? "";
}

const prayerLabels: Record<string, string> = {
  fajr: "الفجر",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};
export function prayerLabel(prayer: string): string {
  return prayerLabels[prayer] ?? prayer;
}
