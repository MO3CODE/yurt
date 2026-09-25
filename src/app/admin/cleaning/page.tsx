import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewCleaningTaskDialog } from "@/components/admin/new-cleaning-task-dialog";
import { CleaningTaskRow } from "@/components/admin/cleaning-task-row";
import { weekStartISO } from "@/lib/date";
import { assignCleaning, setCleaningStatus } from "./actions";
import { requirePermission } from "@/lib/auth/current-user";

export default async function CleaningPage() {
  await requirePermission("cleaning");
  const supabase = await createClient();
  const weekStart = weekStartISO();

  const [{ data: apartments }, { data: facilities }, { data: tasks }, { data: assignments }, { data: students }] = await Promise.all([
    supabase.from("apartments").select("id, name").order("floor_number"),
    supabase.from("facilities").select("id, name").order("name"),
    supabase.from("cleaning_tasks").select("*"),
    supabase.from("cleaning_assignments").select("*").eq("week_start_date", weekStart),
    supabase.from("students").select("id, apartment_id, profiles!students_id_fkey(full_name)"),
  ]);

  const assignmentByTask = new Map((assignments ?? []).map((a) => [a.task_id, a]));

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        title="جدول النظافة"
        description={`أسبوع ${weekStart}`}
        action={<NewCleaningTaskDialog apartments={apartments ?? []} facilities={facilities ?? []} />}
      />

      {(apartments ?? []).map((apt) => {
        const aptTasks = (tasks ?? []).filter((t) => t.scope === "apartment" && t.apartment_id === apt.id);
        const aptStudents = (students ?? [])
          .filter((s) => s.apartment_id === apt.id)
          .map((s) => ({ id: s.id, full_name: (s.profiles as unknown as { full_name: string })?.full_name ?? "—" }));

        if (aptTasks.length === 0) return null;

        return (
          <Card key={apt.id}>
            <CardHeader>
              <CardTitle>{apt.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {aptTasks.map((t) => (
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
              ))}
            </CardContent>
          </Card>
        );
      })}

      {(facilities ?? []).some((f) => (tasks ?? []).some((t) => t.facility_id === f.id)) && (
        <Card>
          <CardHeader>
            <CardTitle>المرافق العامة</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(tasks ?? [])
              .filter((t) => t.scope === "facility")
              .map((t) => (
                <CleaningTaskRow
                  key={t.id}
                  taskId={t.id}
                  taskName={t.name}
                  weekStartDate={weekStart}
                  assignment={assignmentByTask.get(t.id) ?? null}
                  students={(students ?? []).map((s) => ({
                    id: s.id,
                    full_name: (s.profiles as unknown as { full_name: string })?.full_name ?? "—",
                  }))}
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
