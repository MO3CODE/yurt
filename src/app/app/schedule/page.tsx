import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewScheduleEntryDialog } from "@/components/student/new-schedule-entry-dialog";
import { DeleteScheduleButton } from "@/components/student/delete-schedule-button";
import { dayName } from "@/lib/date";

export default async function SchedulePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("class_schedule_entries")
    .select("*")
    .eq("student_id", user.id)
    .order("day_of_week")
    .order("start_time");

  const byDay = new Map<number, typeof entries>();
  for (const e of entries ?? []) {
    if (!byDay.has(e.day_of_week)) byDay.set(e.day_of_week, []);
    byDay.get(e.day_of_week)!.push(e);
  }

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="جدولي الجامعي" description="أدخل جدول محاضراتك الأسبوعي" action={<NewScheduleEntryDialog />} />

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 7 }, (_, day) => (
          <Card key={day}>
            <CardHeader>
              <CardTitle className="text-base">{dayName(day)}</CardTitle>
            </CardHeader>
            <CardContent>
              {byDay.get(day)?.length ? (
                <ul className="flex flex-col gap-2">
                  {byDay.get(day)!.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                      <div>
                        <p className="font-medium">{entry.course_name}</p>
                        <p className="text-muted-foreground">
                          {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                          {entry.location && ` · ${entry.location}`}
                        </p>
                      </div>
                      <DeleteScheduleButton id={entry.id} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد محاضرات</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
