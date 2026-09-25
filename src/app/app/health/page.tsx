import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { HealthRecordList } from "@/components/student/health-record-list";
import { NewHealthRecordDialog } from "@/components/student/new-health-record-dialog";

export default async function HealthPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: records } = await supabase
    .from("health_records")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="حالتي الصحية" description="سجّل أي وعكة صحية لمتابعتها" action={<NewHealthRecordDialog />} />
      <HealthRecordList records={records ?? []} />
    </div>
  );
}
