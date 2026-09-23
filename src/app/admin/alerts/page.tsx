import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GenerateAlertsButton } from "@/components/admin/generate-alerts-button";
import { ResolveAlertButton } from "@/components/admin/resolve-alert-button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Siren } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*, student:student_id(profiles:id(full_name)), apartment:apartment_id(name)")
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="تنبيهات تستدعي الانتباه" description="حالات تحتاج متابعة من الإدارة" action={<GenerateAlertsButton />} />

      {alerts && alerts.length > 0 ? (
        <div className="flex flex-col gap-3">
          {alerts.map((a) => {
            const student = a.student as unknown as { profiles: { full_name: string } } | null;
            const apartment = a.apartment as unknown as { name: string } | null;
            return (
              <Card key={a.id} className={cn(a.severity === "critical" && "border-destructive/40")}>
                <CardContent className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {student?.profiles?.full_name} {apartment && `· ${apartment.name}`}
                    </p>
                    <p className="text-sm text-muted-foreground">{a.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity === "critical" ? "destructive" : "outline"}>
                      {a.severity === "critical" ? "حرج" : "تنبيه"}
                    </Badge>
                    <ResolveAlertButton alertId={a.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <Siren />
          </EmptyMedia>
          <EmptyTitle>لا توجد تنبيهات حالياً</EmptyTitle>
          <EmptyDescription>اضغط &quot;فحص وتحديث التنبيهات&quot; لفحص الحالات الحرجة</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
