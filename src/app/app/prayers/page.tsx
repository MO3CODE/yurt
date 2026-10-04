import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrayerTracker } from "@/components/student/prayer-tracker";
import { PrayerTimesCard } from "@/components/prayer/prayer-times";
import { PrayerReminders } from "@/components/prayer/prayer-reminders";
import { getSchedule } from "@/lib/prayer-times-server";
import { pushConfigured } from "@/lib/push";
import { DEFAULT_REMINDER_SETTINGS } from "@/lib/prayer-reminders";
import { FIVE_PRAYERS, type FivePrayer } from "@/lib/prayer-times";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addDaysISO, todayISO, prayerLabel } from "@/lib/date";
import type { PrayerName, PrayerStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const PRAYERS: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const dotClass: Record<PrayerStatus, string> = {
  mosque: "bg-success",
  prayed: "bg-primary",
  missed: "bg-destructive",
};

export default async function PrayersPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = todayISO();

  const sinceISO = addDaysISO(today, -13);

  const [{ data: records }, { data: settingsRow }, schedule] = await Promise.all([
    supabase
      .from("prayer_records")
      .select("record_date, prayer, status")
      .eq("student_id", user.id)
      .gte("record_date", sinceISO)
      .order("record_date", { ascending: false }),
    supabase.from("prayer_reminder_settings").select("lead_minutes, nudge_minutes, prayers").eq("profile_id", user.id).maybeSingle(),
    getSchedule(supabase),
  ]);

  const reminderSettings = settingsRow
    ? {
        leadMinutes: settingsRow.lead_minutes,
        nudgeMinutes: settingsRow.nudge_minutes,
        prayers: settingsRow.prayers.filter((p): p is FivePrayer => (FIVE_PRAYERS as string[]).includes(p)),
      }
    : { leadMinutes: DEFAULT_REMINDER_SETTINGS.leadMinutes, nudgeMinutes: DEFAULT_REMINDER_SETTINGS.nudgeMinutes, prayers: DEFAULT_REMINDER_SETTINGS.prayers };

  const byDate = new Map<string, Partial<Record<PrayerName, PrayerStatus>>>();
  for (const r of records ?? []) {
    if (!byDate.has(r.record_date)) byDate.set(r.record_date, {});
    byDate.get(r.record_date)![r.prayer] = r.status;
  }

  const days = Array.from(byDate.keys()).filter((d) => d !== today).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="الصلوات" description="أوقات الصلاة في باعجلار وتسجيلك اليومي" />

      <PrayerTimesCard {...schedule} logged={byDate.get(today) ?? {}} />

      <PrayerReminders initial={reminderSettings} serverReady={pushConfigured()} />

      <Card>
        <CardHeader>
          <CardTitle>اليوم</CardTitle>
        </CardHeader>
        <CardContent>
          <PrayerTracker date={today} values={byDate.get(today) ?? {}} times={schedule.today} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>آخر ١٤ يوم</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                {PRAYERS.map((p) => (
                  <TableHead key={p}>{prayerLabel(p)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d) => (
                <TableRow key={d}>
                  <TableCell className="font-medium">{d}</TableCell>
                  {PRAYERS.map((p) => {
                    const status = byDate.get(d)?.[p];
                    return (
                      <TableCell key={p}>
                        {status ? (
                          <span className={cn("inline-block size-2.5 rounded-full", dotClass[status])} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
