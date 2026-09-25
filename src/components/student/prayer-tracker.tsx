"use client";

import { useTransition } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { logPrayer } from "@/app/app/prayers/actions";
import { prayerLabel } from "@/lib/date";
import type { PrayerName, PrayerStatus } from "@/lib/supabase/types";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { cn } from "@/lib/utils";

const PRAYERS: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export function PrayerTracker({
  date,
  values,
}: {
  date: string;
  values: Partial<Record<PrayerName, PrayerStatus>>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {PRAYERS.map((prayer) => (
        <PrayerRow key={prayer} date={date} prayer={prayer} status={values[prayer]} />
      ))}
    </div>
  );
}

function PrayerRow({ date, prayer, status }: { date: string; prayer: PrayerName; status?: PrayerStatus }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(groupValue: string[]) {
    const value = groupValue[0];
    if (!value) return;
    startTransition(async () => {
      try {
        await unwrap(logPrayer(date, prayer, value as PrayerStatus));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر تسجيل الصلاة");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <span className="font-medium">{prayerLabel(prayer)}</span>
      <ToggleGroup
        value={status ? [status] : []}
        onValueChange={handleChange}
        disabled={isPending}
        className={cn(isPending && "opacity-60")}
      >
        <ToggleGroupItem value="mosque">المسجد</ToggleGroupItem>
        <ToggleGroupItem value="prayed">صلّيت</ToggleGroupItem>
        <ToggleGroupItem value="missed">فاتت</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
