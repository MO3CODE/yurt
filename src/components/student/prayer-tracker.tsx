"use client";

import { useOptimistic, useTransition } from "react";
import { Check, CloudSun, Landmark, Moon, Sun, Sunrise, Sunset, X, type LucideIcon } from "lucide-react";
import { logPrayer } from "@/app/app/prayers/actions";
import { prayerLabel } from "@/lib/date";
import type { PrayerName, PrayerStatus } from "@/lib/supabase/types";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { cn } from "@/lib/utils";

const PRAYERS: { name: PrayerName; icon: LucideIcon; hint: string }[] = [
  { name: "fajr", icon: Sunrise, hint: "قبل الشروق" },
  { name: "dhuhr", icon: Sun, hint: "منتصف النهار" },
  { name: "asr", icon: CloudSun, hint: "العصر" },
  { name: "maghrib", icon: Sunset, hint: "عند الغروب" },
  { name: "isha", icon: Moon, hint: "الليل" },
];

const OPTIONS: { value: PrayerStatus; label: string; icon: LucideIcon; active: string }[] = [
  { value: "mosque", label: "المسجد", icon: Landmark, active: "bg-primary text-primary-foreground shadow-sm shadow-primary/25" },
  { value: "prayed", label: "صلّيت", icon: Check, active: "bg-success text-success-foreground shadow-sm shadow-success/25" },
  { value: "missed", label: "فاتت", icon: X, active: "bg-destructive text-white shadow-sm shadow-destructive/25" },
];

export function PrayerTracker({
  date,
  values,
}: {
  date: string;
  values: Partial<Record<PrayerName, PrayerStatus>>;
}) {
  // حالة متفائلة لكل الصلوات: الاختيار وشريط التقدّم يتحدّثان فوراً ويرجعان لو فشل الحفظ
  const [optimistic, setOptimistic] = useOptimistic(
    values,
    (state, change: { name: PrayerName; value: PrayerStatus }) => ({ ...state, [change.name]: change.value })
  );
  const done = PRAYERS.filter((p) => optimistic[p.name] === "mosque" || optimistic[p.name] === "prayed").length;

  return (
    <div className="flex flex-col gap-3">
      {/* تقدّم اليوم */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {PRAYERS.map((p) => {
            const s = optimistic[p.name];
            return (
              <span
                key={p.name}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-500",
                  s === "mosque" ? "bg-primary" : s === "prayed" ? "bg-success" : s === "missed" ? "bg-destructive/60" : "bg-muted"
                )}
              />
            );
          })}
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {done} / {PRAYERS.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {PRAYERS.map((p) => (
          <PrayerRow
            key={p.name}
            date={date}
            prayer={p}
            status={optimistic[p.name]}
            onOptimistic={(value) => setOptimistic({ name: p.name, value })}
          />
        ))}
      </div>
    </div>
  );
}

function PrayerRow({
  date,
  prayer,
  status: optimistic,
  onOptimistic,
}: {
  date: string;
  prayer: (typeof PRAYERS)[number];
  status?: PrayerStatus;
  onOptimistic: (value: PrayerStatus) => void;
}) {
  const [, startTransition] = useTransition();
  const Icon = prayer.icon;

  function choose(value: PrayerStatus) {
    if (value === optimistic) return;
    startTransition(async () => {
      onOptimistic(value);
      try {
        await unwrap(logPrayer(date, prayer.name, value));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر تسجيل الصلاة");
      }
    });
  }

  const completed = optimistic === "mosque" || optimistic === "prayed";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border p-2 ps-2.5 sm:gap-3 sm:p-2.5 sm:ps-3 transition-colors duration-300",
        completed ? "border-primary/20 bg-primary/[0.04]" : optimistic === "missed" ? "border-destructive/20 bg-destructive/[0.03]" : "bg-card"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors sm:size-9 duration-300",
            completed ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-[1.1rem]" />
        </div>
        <div className="flex flex-col leading-tight whitespace-nowrap">
          <span className="font-heading font-semibold">{prayerLabel(prayer.name)}</span>
          <span className="hidden text-xs text-muted-foreground sm:block">{prayer.hint}</span>
        </div>
      </div>

      <div role="radiogroup" aria-label={`صلاة ${prayerLabel(prayer.name)}`} className="flex gap-1 rounded-xl bg-muted/70 p-1">
        {OPTIONS.map((o) => {
          const selected = optimistic === o.value;
          const OIcon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(o.value)}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-200 active:scale-95",
                selected ? cn(o.active, "animate-pop") : "text-muted-foreground hover:bg-background hover:text-foreground"
              )}
            >
              <OIcon className="hidden size-3.5 sm:block" />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
