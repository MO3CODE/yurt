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

/** نطاق الأسبوع للعرض: «٢٠–٢٦ سبتمبر» أو «٢٧ سبتمبر – ٣ أكتوبر» */
export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(`${addDaysISO(weekStart, 6)}T00:00:00Z`);
  const day = new Intl.DateTimeFormat("ar-u-nu-arab", { timeZone: "UTC", day: "numeric" });
  const dayMonth = new Intl.DateTimeFormat("ar-u-nu-arab", { timeZone: "UTC", day: "numeric", month: "long" });
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${day.format(start)}–${dayMonth.format(end)}`
    : `${dayMonth.format(start)} – ${dayMonth.format(end)}`;
}

export function monthStartISO(date = todayISO()): string {
  return `${date.slice(0, 7)}-01`;
}

/** التاريخ الهجري (أم القرى) مثل «٣ ربيع الآخر ١٤٤٨ هـ» */
export function hijriDate(date = new Date()): string {
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** التاريخ الميلادي الطويل مثل «الجمعة، ٢٥ سبتمبر» */
export function longDate(date = new Date()): string {
  return new Intl.DateTimeFormat("ar-u-nu-arab", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** تحية حسب ساعة اليوم بتوقيت المنصة */
export function greeting(date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, hour: "numeric", hourCycle: "h23" }).format(date)
  );
  if (hour < 5) return "طابت ليلتك";
  if (hour < 12) return "صباح الخير";
  if (hour < 17) return "نهارك سعيد";
  return "مساء الخير";
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
