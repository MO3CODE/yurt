import { SprayCan } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NewCleaningTaskDialog } from "@/components/admin/new-cleaning-task-dialog";
import { CleaningTaskRow } from "@/components/admin/cleaning-task-row";
import { AutoScheduleBar } from "@/components/cleaning/auto-schedule-bar";
import { DefaultTasksButton } from "@/components/cleaning/default-tasks-button";
import { formatWeekRange, weekStartISO } from "@/lib/date";
import { assignCleaning, generateCleaningSchedule, setCleaningStatus } from "./actions";
import { requirePermission } from "@/lib/auth/current-user";

export default async function CleaningPage() {
  await requirePermission("cleaning");
  const supabase = await createClient();
  const weekStart = weekStartISO();

  const [{ data: apartments }, { data: facilities }, { data: tasks }, { data: assignments }, { data: students }] = await Promise.all([
    supabase.from("apartments").select("id, name").order("floor_number"),
    supabase.from("facilities").select("id, name").order("name"),
    supabase.from("cleaning_tasks").select("*").order("created_at"),
    supabase.from("cleaning_assignments").select("*").eq("week_start_date", weekStart),
    supabase.from("students").select("id, apartment_id, profiles!students_id_fkey(full_name)").eq("status", "active"),
  ]);

  const assignmentByTask = new Map((assignments ?? []).map((a) => [a.task_id, a]));
  const toOption = (s: NonNullable<typeof students>[number]) => ({
    id: s.id,
    full_name: (s.profiles as unknown as { full_name: string })?.full_name ?? "—",
  });
  const facilityTasks = (tasks ?? []).filter((t) => t.scope === "facility");

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        title="جدول النظافة"
        description="توزيع أسبوعي تلقائي على طلاب كل شقة، مع إمكانية التعديل اليدوي"
        action={<NewCleaningTaskDialog apartments={apartments ?? []} facilities={facilities ?? []} />}
      />

      <AutoScheduleBar weekLabel={formatWeekRange(weekStart)} scopeLabel="كل الشقق" generate={generateCleaningSchedule} />

      {(apartments ?? []).length === 0 && (
        <Empty>
          <EmptyMedia variant="icon">
            <SprayCan />
          </EmptyMedia>
          <EmptyTitle>لا توجد شقق بعد</EmptyTitle>
          <EmptyDescription>أضف الشقق وطلابها أولاً، ثم مهام النظافة لكل شقة</EmptyDescription>
        </Empty>
      )}

      {(apartments ?? []).map((apt) => {
        const aptTasks = (tasks ?? []).filter((t) => t.scope === "apartment" && t.apartment_id === apt.id);
        const aptStudents = (students ?? []).filter((s) => s.apartment_id === apt.id).map(toOption);
        const doneCount = aptTasks.filter((t) => assignmentByTask.get(t.id)?.status === "done").length;

        return (
          <Card key={apt.id}>
            <CardHeader>
              <CardTitle>{apt.name}</CardTitle>
              <CardDescription>
                {aptStudents.length} طالب · {aptTasks.length} مهمة
                {aptTasks.length > 0 && ` · أُنجز ${doneCount} من ${aptTasks.length}`}
              </CardDescription>
              {aptTasks.length === 0 && (
                <CardAction>
                  <DefaultTasksButton apartmentId={apt.id} />
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {aptTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  لا مهام لهذه الشقة بعد — أضف المهام الأساسية (المطبخ، الحمام، الصالة، النفايات) لتبدأ بالتوزيع التلقائي.
                </p>
              ) : aptStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا يوجد طلاب نشطون في الشقة لتوزيع المهام عليهم.</p>
              ) : (
                aptTasks.map((t) => (
                  <CleaningTaskRow
                    key={t.id}
                    taskId={t.id}
                    taskName={t.name}
                    weekStartDate={weekStart}
                    assignment={assignmentByTask.get(t.id) ?? null}
                    students={aptStudents}
                    onAssign={assignCleaning}
                    onStatusChange={setCleaningStatus}
                  />
                ))
              )}
            </CardContent>
          </Card>
        );
      })}

      {facilityTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>المرافق العامة</CardTitle>
            <CardDescription>تدور على كل طلاب السكن النشطين</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {facilityTasks.map((t) => (
              <CleaningTaskRow
                key={t.id}
                taskId={t.id}
                taskName={t.name}
                weekStartDate={weekStart}
                assignment={assignmentByTask.get(t.id) ?? null}
                students={(students ?? []).map(toOption)}
                onAssign={assignCleaning}
                onStatusChange={setCleaningStatus}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
