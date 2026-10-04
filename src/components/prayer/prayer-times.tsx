"use client";

import { Check, Clock, MapPin, Moon, MoonStar, Sun, CloudSun, Sunrise, Sunset, X, type LucideIcon } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import {
  PRAYER_PLACE,
  TIMED_LABELS,
  TIMED_ORDER,
  formatCountdown,
  nextPrayer,
  toInstant,
  type DayTimes,
  type TimedPrayer,
} from "@/lib/prayer-times";
import type { PrayerStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const ICONS: Record<TimedPrayer, LucideIcon> = {
  fajr: MoonStar,
  sunrise: Sunrise,
  dhuhr: Sun,
  asr: CloudSun,
  maghrib: Sunset,
  isha: Moon,
};

type Schedule = { today: DayTimes; tomorrow: DayTimes; nowIso: string };

/** بطاقة أوقات الصلاة: الصلاة القادمة بعدّ تنازلي حيّ + أوقات اليوم الستة */
export function PrayerTimesCard({
  today,
  tomorrow,
  nowIso,
  logged = {},
}: Schedule & { logged?: Partial<Record<TimedPrayer, PrayerStatus>> }) {
  const now = useNow(nowIso);
  const upcoming = nextPrayer(today, tomorrow, now);
  const nextToday = upcoming && !upcoming.isTomorrow ? upcoming.prayer : null;

  return (
    <section className="@container">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" /> {PRAYER_PLACE.label}
            </span>
            {upcoming ? (
              <>
                <span className="text-sm text-muted-foreground">{upcoming.isTomorrow ? "الصلاة القادمة (غداً)" : "الصلاة القادمة"}</span>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-heading text-3xl font-semibold">{TIMED_LABELS[upcoming.prayer]}</span>
                  <span className="font-heading text-2xl text-primary tabular-nums" dir="ltr">
                    {upcoming.isTomorrow ? tomorrow.fajr : today[upcoming.prayer]}
                  </span>
                </div>
                <span className="w-fit rounded-full bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
                  {formatCountdown(upcoming.at.getTime() - now.getTime())}
                </span>
              </>
            ) : (
              <span className="font-heading text-xl font-semibold">أوقات اليوم</span>
            )}
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              today.source === "diyanet" ? "bg-success/12 text-success" : "bg-warning/18 text-warning-foreground dark:text-warning"
            )}
            title={today.source === "diyanet" ? "من جدول رئاسة الشؤون الدينية التركية" : "حساب فلكي تقريبي، الجدول الرسمي غير متاح الآن"}
          >
            {today.source === "diyanet" ? "الجدول الرسمي" : "تقديرية"}
          </span>
        </div>

        <ul className="grid grid-cols-3 gap-2 @lg:grid-cols-6">
          {TIMED_ORDER.map((p) => {
            const Icon = ICONS[p];
            const passed = toInstant(today.day, today[p]).getTime() <= now.getTime();
            const isNext = nextToday === p;
            const status = logged[p];
            return (
              <li
                key={p}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center transition-colors",
                  isNext && "border-primary/50 bg-primary/[0.07] ring-1 ring-primary/30",
                  passed && !isNext && "opacity-60",
                  p === "sunrise" && "border-dashed"
                )}
              >
                <Icon className={cn("size-5", isNext ? "text-primary" : "text-muted-foreground")} />
                <span className="text-xs font-medium">{TIMED_LABELS[p]}</span>
                <span className="font-heading text-base font-semibold tabular-nums" dir="ltr">
                  {today[p]}
                </span>
                {status && p !== "sunrise" && (
                  <span
                    className={cn(
                      "absolute end-1.5 top-1.5 flex size-4 items-center justify-center rounded-full",
                      status === "missed" ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
                    )}
                    aria-label={status === "missed" ? "فاتت" : "أُدّيت"}
                  >
                    {status === "missed" ? <X className="size-3" /> : <Check className="size-3" />}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** حبة صغيرة «الظهر 12:58 · بعد 42 دقيقة» لرأس الصفحات الرئيسية */
export function NextPrayerChip({ today, tomorrow, nowIso, className }: Schedule & { className?: string }) {
  const now = useNow(nowIso);
  const upcoming = nextPrayer(today, tomorrow, now);
  if (!upcoming) return null;
  const hm = upcoming.isTomorrow ? tomorrow.fajr : today[upcoming.prayer];
  return (
    <span className={cn("inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium", className)}>
      <Clock className="size-3.5" />
      <span>
        {TIMED_LABELS[upcoming.prayer]}{" "}
        <span className="tabular-nums" dir="ltr">
          {hm}
        </span>
      </span>
      <span className="opacity-70">· {formatCountdown(upcoming.at.getTime() - now.getTime())}</span>
    </span>
  );
}
