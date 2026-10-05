import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TaskList } from "@/components/student/task-list";
import { NewTaskDialog } from "@/components/student/new-task-dialog";
import { LearningToday } from "@/components/learning/learning-today";
import { getMyCourses } from "@/lib/learning/server";
import { todayISO } from "@/lib/date";

export default async function TasksPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: tasks }, myCourses] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("student_id", user.id)
      .order("status")
      .order("due_date", { ascending: true, nullsFirst: false }),
    getMyCourses(supabase, user.id, todayISO()),
  ]);

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="مهامي" description="مهامك الشخصية ودروس اليوم من كورساتك" action={<NewTaskDialog />} />
      <LearningToday courses={myCourses} />
      <Card>
        <CardContent>
          <TaskList tasks={tasks ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
