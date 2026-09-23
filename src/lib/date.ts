// المنطقة الزمنية المرجعية للمنصة — عدّلها إذا احتجت
export const APP_TIMEZONE = "Europe/Istanbul";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
}

export function weekStartISO(date = todayISO()): string {
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDay(); // 0 = الأحد
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
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
