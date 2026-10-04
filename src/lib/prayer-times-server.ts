import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { addDaysISO, todayISO } from "@/lib/date";
import { DIYANET_URL, calculateTimes, parseDiyanetDays, type DayTimes } from "@/lib/prayer-times";

type Db = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["prayer_times"]["Row"];

const hm = (t: string) => t.slice(0, 5); // 05:28:00 → 05:28

function rowToDay(r: Row): DayTimes {
  return {
    day: r.day,
    source: "diyanet",
    fajr: hm(r.fajr),
    sunrise: hm(r.sunrise),
    dhuhr: hm(r.dhuhr),
    asr: hm(r.asr),
    maghrib: hm(r.maghrib),
    isha: hm(r.isha),
  };
}

/** أوقات الأيام المطلوبة: الجدول الرسمي من القاعدة، وللأيام الناقصة الحساب الاحتياطي */
export async function getDayTimesMap(supabase: Db, days: string[]): Promise<Map<string, DayTimes>> {
  const { data } = await supabase.from("prayer_times").select("*").in("day", days);
  const map = new Map<string, DayTimes>((data ?? []).map((r) => [r.day, rowToDay(r)]));
  for (const d of days) if (!map.has(d)) map.set(d, calculateTimes(d));
  return map;
}

/** جدول اليوم والغد + لحظة الطلب (لتهيئة العدّ التنازلي في المتصفح دون اختلاف عن السيرفر) */
export async function getSchedule(supabase: Db) {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const map = await getDayTimesMap(supabase, [today, tomorrow]);
  return { nowIso: new Date().toISOString(), today: map.get(today)!, tomorrow: map.get(tomorrow)! };
}

/** يجلب الجدول الرسمي (٣٠ يوماً قادمة) ويحفظه؛ الأيام التالفة تُهمل. يتطلب عميل service role. */
export async function syncOfficialTimes(admin: Db): Promise<{ upserted: number; rejected: number; error?: string }> {
  try {
    const res = await fetch(DIYANET_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return { upserted: 0, rejected: 0, error: `HTTP ${res.status}` };

    const { days, rejected } = parseDiyanetDays(await res.json());
    if (days.length === 0) return { upserted: 0, rejected, error: "لا أيام صالحة في الاستجابة" };

    const fetchedAt = new Date().toISOString();
    const { error } = await admin.from("prayer_times").upsert(
      days.map((d) => ({
        day: d.day,
        fajr: d.fajr,
        sunrise: d.sunrise,
        dhuhr: d.dhuhr,
        asr: d.asr,
        maghrib: d.maghrib,
        isha: d.isha,
        source: "diyanet" as const,
        fetched_at: fetchedAt,
      })),
      { onConflict: "day" }
    );
    if (error) return { upserted: 0, rejected, error: error.message };
    return { upserted: days.length, rejected };
  } catch (e) {
    return { upserted: 0, rejected: 0, error: e instanceof Error ? e.message : "فشل الاتصال بالمصدر" };
  }
}
