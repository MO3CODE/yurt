import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewFacilityDialog } from "@/components/admin/new-facility-dialog";
import { ReportFacilityIssueDialog } from "@/components/admin/report-facility-issue-dialog";
import { ResolveIssueButton } from "@/components/admin/resolve-issue-button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Building2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/current-user";

const priorityLabels: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" };

export default async function FacilitiesPage() {
  await requirePermission("facilities");
  const supabase = await createClient();
  const [{ data: facilities }, { data: issues }] = await Promise.all([
    supabase.from("facilities").select("*").order("name"),
    supabase.from("facility_issues").select("*, facility:facility_id(name)").eq("status", "open").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        title="المرافق"
        description="المصلى، الديوانية، الحوش، المصاعد، الدرج وغيرها"
        action={
          <div className="flex gap-2">
            <ReportFacilityIssueDialog facilities={facilities ?? []} />
            <NewFacilityDialog />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>بلاغات مفتوحة</CardTitle>
        </CardHeader>
        <CardContent>
          {issues && issues.length > 0 ? (
            <div className="flex flex-col gap-2">
              {issues.map((i) => {
                const facility = i.facility as unknown as { name: string } | null;
                return (
                  <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{facility?.name}</p>
                      <p className="text-sm text-muted-foreground">{i.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={i.priority === "urgent" ? "destructive" : "outline"}>{priorityLabels[i.priority]}</Badge>
                      <ResolveIssueButton issueId={i.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد بلاغات مفتوحة</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>كل المرافق</CardTitle>
        </CardHeader>
        <CardContent>
          {facilities && facilities.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {facilities.map((f) => (
                <div key={f.id} className="rounded-lg border p-3">
                  <p className="font-medium">{f.name}</p>
                  {f.floor_number != null && <p className="text-xs text-muted-foreground">طابق {f.floor_number}</p>}
                </div>
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>لا توجد مرافق مسجّلة بعد</EmptyTitle>
              <EmptyDescription>أضف المصلى، الديوانية، الحوش وغيرها</EmptyDescription>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
