import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NewComplaintDialog } from "@/components/student/new-complaint-dialog";
import { ReportFacilityIssueDialog } from "@/components/admin/report-facility-issue-dialog";
import { MessageSquareWarning } from "lucide-react";

const statusLabels: Record<string, string> = {
  new: "جديدة",
  triaged: "قيد المراجعة",
  in_progress: "قيد المعالجة",
  escalated: "مُصعَّدة للإدارة",
  resolved: "تم الحل",
  rejected: "مرفوضة",
};

export default async function ComplaintsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: complaints }, { data: facilities }] = await Promise.all([
    supabase.from("complaints").select("*").eq("student_id", user.id).order("created_at", { ascending: false }),
    supabase.from("facilities").select("id, name").order("name"),
  ]);

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        title="الشكاوى والمقترحات"
        description="قدّم شكوى أو مقترح وتابع حالته، أو بلّغ عن عطل في مرفق"
        action={
          <>
            {facilities && facilities.length > 0 && <ReportFacilityIssueDialog facilities={facilities} />}
            <NewComplaintDialog />
          </>
        }
      />

      {complaints && complaints.length > 0 ? (
        <div className="flex flex-col gap-3">
          {complaints.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.subject}</span>
                  <Badge variant="secondary">{statusLabels[c.status]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.description}</p>
                {c.supervisor_response && (
                  <p className="rounded-lg bg-accent/40 p-2 text-sm">رد المشرف: {c.supervisor_response}</p>
                )}
                {c.admin_response && (
                  <p className="rounded-lg bg-accent/40 p-2 text-sm">رد الإدارة: {c.admin_response}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <Empty>
              <EmptyMedia variant="icon">
                <MessageSquareWarning />
              </EmptyMedia>
              <EmptyTitle>لا توجد شكاوى أو مقترحات</EmptyTitle>
              <EmptyDescription>يمكنك تقديم شكوى أو مقترح بأي وقت</EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
