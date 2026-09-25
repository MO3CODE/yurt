import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TaskList } from "@/components/student/task-list";
import { NewTaskDialog } from "@/components/student/new-task-dialog";

export default async function TasksPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("student_id", user.id)
    .order("status")
    .order("due_date", { ascending: true, nullsFirst: false });

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="مهامي" description="قائمة مهامك الشخصية" action={<NewTaskDialog />} />
      <Card>
        <CardContent>
          <TaskList tasks={tasks ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
