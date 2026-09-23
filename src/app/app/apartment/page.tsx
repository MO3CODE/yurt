import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComplaintCard } from "@/components/admin/complaint-card";
import { CleaningTaskRow } from "@/components/admin/cleaning-task-row";
import { SupervisorAttendanceRow } from "@/components/student/supervisor-attendance-row";
import { todayISO, weekStartISO } from "@/lib/date";
import {
  updateComplaintAsSupervisor,
  assignCleaningAsSupervisor,
  setCleaningStatusAsSupervisor,
} from "./actions";

export default async function SupervisorApartmentPage() {
  const user = await requireUser();
  if (!user.supervisedApartmentId) redirect("/app");

  const supabase = await createClient();
  const apartmentId = user.supervisedApartmentId;
  const today = todayISO();
  const weekStart = weekStartISO();

  const [{ data: apartment }, { data: students }, { data: complaints }, { data: tasks }, { data: assignments }, { data: attendance }] =
    await Promise.all([
      supabase.from("apartments").select("name").eq("id", apartmentId).single(),
      supabase.from("students").select("id, profiles:id(full_name)").eq("apartment_id", apartmentId),
      supabase
        .from("complaints")
        .select("*")
        .eq("apartment_id", apartmentId)
        .order("created_at", { ascending: false }),
      supabase.from("cleaning_tasks").select("*").eq("apartment_id", apartmentId),
      supabase.from("cleaning_assignments").select("*").eq("week_start_date", weekStart),
      supabase.from("attendance_records").select("student_id, status").eq("record_date", today),
    ]);

  const studentOptions = (students ?? []).map((s) => ({
    id: s.id,
    full_name: (s.profiles as unknown as { full_name: string })?.full_name ?? "—",
  }));
  const assignmentByTask = new Map((assignments ?? []).map((a) => [a.task_id, a]));
  const attendanceByStudent = new Map((attendance ?? []).map((a) => [a.student_id, a.status]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`إدارة شقتك — ${apartment?.name ?? ""}`} description="صلاحياتك كمشرف على الشقة" />

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">الحضور اليومي</TabsTrigger>
          <TabsTrigger value="complaints">الشكاوى والمقترحات</TabsTrigger>
          <TabsTrigger value="cleaning">جدول النظافة</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="flex flex-col gap-2">
          <Card>
            <CardHeader>
              <CardTitle>اعتماد حضور اليوم</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {studentOptions.map((s) => (
                <SupervisorAttendanceRow
                  key={s.id}
                  studentId={s.id}
                  studentName={s.full_name}
                  date={today}
                  status={attendanceByStudent.get(s.id)}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complaints" className="flex flex-col gap-3">
          {(complaints ?? []).length > 0 ? (
            (complaints ?? []).map((c) => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                studentName=""
                statusOptions={["new", "triaged", "in_progress", "escalated", "resolved"]}
                responseFieldName="supervisor_response"
                onSave={updateComplaintAsSupervisor}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد شكاوى لشقتك</p>
          )}
        </TabsContent>

        <TabsContent value="cleaning">
          <Card>
            <CardHeader>
              <CardTitle>أسبوع {weekStart}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(tasks ?? []).length > 0 ? (
                (tasks ?? []).map((t) => (
                  <CleaningTaskRow
                    key={t.id}
                    taskId={t.id}
                    taskName={t.name}
                    weekStartDate={weekStart}
                    assignment={assignmentByTask.get(t.id) ?? null}
                    students={studentOptions}
                    onAssign={assignCleaningAsSupervisor}
                    onStatusChange={setCleaningStatusAsSupervisor}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">لم تُضِف الإدارة مهام نظافة لشقتك بعد</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
