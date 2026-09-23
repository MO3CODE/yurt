import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrayerTracker } from "@/components/student/prayer-tracker";
import { AttendanceToday } from "@/components/student/attendance-today";
import { TaskList } from "@/components/student/task-list";
import { Trophy, ListTodo, CalendarDays, BellRing } from "lucide-react";
import { todayISO, dayName } from "@/lib/date";
import type { PrayerName, PrayerStatus } from "@/lib/supabase/types";

export default async function StudentHomePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = todayISO();
  const todayDayOfWeek = new Date(`${today}T00:00:00`).getDay();

  const [{ data: prayerRows }, { data: attendanceRow }, { data: tasks }, { data: classesToday }, { data: pointsRows }, { count: unreadCount }] =
    await Promise.all([
      supabase.from("prayer_records").select("prayer, status").eq("student_id", user.id).eq("record_date", today),
      supabase.from("attendance_records").select("status").eq("student_id", user.id).eq("record_date", today).maybeSingle(),
      supabase.from("tasks").select("*").eq("student_id", user.id).eq("status", "pending").order("due_date", { ascending: true }).limit(5),
      supabase
        .from("class_schedule_entries")
        .select("*")
        .eq("student_id", user.id)
        .eq("day_of_week", todayDayOfWeek)
        .order("start_time"),
      supabase.from("points_entries").select("points").eq("student_id", user.id),
      supabase.from("notifications").select("id", { count: "exact", head: true }),
    ]);

  const prayerValues: Partial<Record<PrayerName, PrayerStatus>> = {};
  for (const p of prayerRows ?? []) prayerValues[p.prayer] = p.status;

  const totalPoints = (pointsRows ?? []).reduce((sum, p) => sum + p.points, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`أهلاً، ${user.fullName.split(" ")[0]}`} description={`اليوم ${dayName(todayDayOfWeek)}`} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="مجموع نقاطك" value={totalPoints} icon={Trophy} tone="success" />
        <StatCard label="مهام قيد الإنجاز" value={tasks?.length ?? 0} icon={ListTodo} />
        <StatCard label="محاضرات اليوم" value={classesToday?.length ?? 0} icon={CalendarDays} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>صلوات اليوم</CardTitle>
            <CardAction>
              <Button variant="link" size="sm" nativeButton={false} render={<Link href="/app/prayers" />}>
                التفاصيل
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <PrayerTracker date={today} values={prayerValues} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>حضورك اليوم</CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceToday date={today} status={attendanceRow?.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>محاضرات اليوم</CardTitle>
            </CardHeader>
            <CardContent>
              {classesToday && classesToday.length > 0 ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {classesToday.map((c) => (
                    <li key={c.id} className="flex justify-between rounded-lg border p-2.5">
                      <span className="font-medium">{c.course_name}</span>
                      <span className="text-muted-foreground">{c.start_time.slice(0, 5)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد محاضرات اليوم</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مهامك</CardTitle>
          <CardAction>
            <Button variant="link" size="sm" nativeButton={false} render={<Link href="/app/tasks" />}>
              عرض الكل
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TaskList tasks={tasks ?? []} />
        </CardContent>
      </Card>

      {unreadCount ? (
        <div className="flex items-center gap-2 rounded-lg border bg-accent/40 p-3 text-sm">
          <BellRing className="size-4 text-primary" />
          <span>عندك إشعارات جديدة</span>
          <Button variant="link" size="sm" className="ms-auto" nativeButton={false} render={<Link href="/app/notifications" />}>
            عرضها
          </Button>
        </div>
      ) : null}
    </div>
  );
}
