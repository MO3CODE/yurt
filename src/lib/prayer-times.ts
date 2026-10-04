// أوقات الصلاة في باعجلار (إسطنبول) — دوال نقية تعمل في الواجهة والسيرفر.
//
// المصدر الأساسي: جدول رئاسة الشؤون الدينية التركية (Diyanet). لا تنشر الرئاسة جدولاً مستقلاً
// لباعجلار؛ كل أحياء إسطنبول المركزية (ومنها باعجلار) تتبع جدول «İstanbul» (المعرّف 9541).
// الاحتياطي: حساب فلكي بطريقة الشؤون الدينية مضبوط على الجدول الرسمي (فرق أقل من دقيقة).
import { CalculationMethod, Coordinates, PrayerTimes, Rounding } from "adhan";

export const PRAYER_PLACE = {
  label: "باعجلار، إسطنبول",
  district: "باعجلار",
  city: "إسطنبول",
} as const;

export const DIYANET_ISTANBUL_ID = 9541;
export const DIYANET_URL = `https://ezanvakti.emushaf.net/vakitler/${DIYANET_ISTANBUL_ID}`;

export type TimedPrayer = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
export type FivePrayer = Exclude<TimedPrayer, "sunrise">;

export const TIMED_ORDER: TimedPrayer[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
export const FIVE_PRAYERS: FivePrayer[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export const TIMED_LABELS: Record<TimedPrayer, string> = {
  fajr: "الفجر",
  sunrise: "الشروق",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};

export type DayTimes = Record<TimedPrayer, string> & {
  /** اليوم المحلي بتوقيت إسطنبول (YYYY-MM-DD) */
  day: string;
  source: "diyanet" | "calculated";
};

// تركيا بلا توقيت صيفي منذ ٢٠١٦: إسطنبول = UTC+3 دائماً
const ISTANBUL_OFFSET = "+03:00";

/** لحظة (UTC) لوقت محلي بتوقيت إسطنبول */
export function toInstant(day: string, hhmm: string): Date {
  return new Date(`${day}T${hhmm}:00${ISTANBUL_OFFSET}`);
}

const hmFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** «HH:mm» بتوقيت إسطنبول للحظة معيّنة */
export function istanbulHM(d: Date): string {
  return hmFormat.format(d);
}

function minutesToHM(total: number): string {
  const m = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------------
// الحساب الاحتياطي
// ---------------------------------------------------------------------

// مركز إسطنبول (مرجع الشؤون الدينية). فروق الثواني ضُبطت على جدول ٣٠ سبتمبر – ٣١ أكتوبر ٢٠٢٦:
// كل الأوقات ضمن دقيقة واحدة من الرسمي، و٨٠–٩٠٪ منها مطابقة تماماً.
const COORDS = new Coordinates(41.0082, 28.9784);
const OFFSET_SECONDS: Record<TimedPrayer, number> = {
  fajr: -30,
  sunrise: -30,
  dhuhr: -30,
  asr: 60,
  maghrib: 30,
  isha: 30,
};

const istanbulSecondsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function istanbulSeconds(d: Date): number {
  const [h, m, s] = istanbulSecondsFormat.format(d).split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

export function calculateTimes(day: string): DayTimes {
  const params = CalculationMethod.Turkey();
  params.rounding = Rounding.None;
  params.adjustments = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
  // الظهيرة UTC تضمن أن «اليوم» نفسه في أي منطقة زمنية للسيرفر
  const pt = new PrayerTimes(COORDS, new Date(`${day}T12:00:00Z`), params);
  const at: Record<TimedPrayer, Date> = {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
  const out = { day, source: "calculated" } as DayTimes;
  for (const k of TIMED_ORDER) out[k] = minutesToHM(Math.ceil((istanbulSeconds(at[k]) + OFFSET_SECONDS[k]) / 60));
  return out;
}

// ---------------------------------------------------------------------
// الجدول الرسمي (Diyanet)
// ---------------------------------------------------------------------

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

type DiyanetDay = {
  MiladiTarihKisa?: unknown;
  Imsak?: unknown;
  Gunes?: unknown;
  Ogle?: unknown;
  Ikindi?: unknown;
  Aksam?: unknown;
  Yatsi?: unknown;
};

/**
 * يقرأ استجابة الجدول الرسمي ويتحقق من كل يوم: صيغة الوقت، وترتيبه المنطقي، وقربه من الحساب الفلكي
 * (فرق أكثر من ٢٠ دقيقة = بيانات تالفة تُهمل). الأيام غير الصالحة تُتجاهل ولا تُفسد البقية.
 */
export function parseDiyanetDays(json: unknown): { days: DayTimes[]; rejected: number } {
  const days: DayTimes[] = [];
  let rejected = 0;
  if (!Array.isArray(json)) return { days, rejected: 1 };

  for (const raw of json as DiyanetDay[]) {
    const m = typeof raw?.MiladiTarihKisa === "string" ? raw.MiladiTarihKisa.match(/^(\d{2})\.(\d{2})\.(\d{4})$/) : null;
    const times = [raw?.Imsak, raw?.Gunes, raw?.Ogle, raw?.Ikindi, raw?.Aksam, raw?.Yatsi];
    if (!m || !times.every((t): t is string => typeof t === "string" && HM.test(t))) {
      rejected++;
      continue;
    }
    const day = `${m[3]}-${m[2]}-${m[1]}`;
    const d: DayTimes = { day, source: "diyanet", fajr: times[0], sunrise: times[1], dhuhr: times[2], asr: times[3], maghrib: times[4], isha: times[5] };

    const mins = TIMED_ORDER.map((k) => hmToMinutes(d[k]));
    const ordered = mins.every((v, i) => i === 0 || v > mins[i - 1]);
    const calc = calculateTimes(day);
    const close = TIMED_ORDER.every((k) => Math.abs(hmToMinutes(d[k]) - hmToMinutes(calc[k])) <= 20);
    if (!ordered || !close) {
      rejected++;
      continue;
    }
    days.push(d);
  }
  return { days, rejected };
}

// ---------------------------------------------------------------------
// الصلاة القادمة
// ---------------------------------------------------------------------

export type UpcomingPrayer = { prayer: FivePrayer; at: Date; isTomorrow: boolean };

/** أقرب صلاة (من الخمس) بعد اللحظة الحالية؛ بعد العشاء تكون فجر الغد */
export function nextPrayer(today: DayTimes, tomorrow: DayTimes | null, now: Date): UpcomingPrayer | null {
  for (const p of FIVE_PRAYERS) {
    const at = toInstant(today.day, today[p]);
    if (at.getTime() > now.getTime()) return { prayer: p, at, isTomorrow: false };
  }
  if (!tomorrow) return null;
  return { prayer: "fajr", at: toInstant(tomorrow.day, tomorrow.fajr), isTomorrow: true };
}

/** «بعد ٤٢ دقيقة» / «بعد ساعة و١٥ دقيقة» */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 60000));
  if (total < 1) return "الآن";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `بعد ${m} دقيقة`;
  const hours = h === 1 ? "ساعة" : h === 2 ? "ساعتين" : `${h} ساعات`;
  return m === 0 ? `بعد ${hours}` : `بعد ${hours} و${m} دقيقة`;
}
