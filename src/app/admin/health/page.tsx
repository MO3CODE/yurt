import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Stethoscope } from "lucide-react";
import { requirePermission } from "@/lib/auth/current-user";

const severityLabels: Record<string, string> = { mild: "بسيطة", moderate: "متوسطة", severe: "شديدة" };

export default async function AdminHealthPage() {
  await requirePermission("health");
  const supabase = await createClient();
  const { data: records } = await supabase
    .from("health_records")
    .select("*, student:student_id(profiles!students_id_fkey(full_name), apartment:apartment_id(name))")
    .order("created_at", { ascending: false });

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="السجل الصحي" description="متابعة الحالات الصحية لكل الطلاب" />

      {records && records.length > 0 ? (
        <div className="flex flex-col gap-3">
          {records.map((r) => {
            const student = r.student as unknown as { profiles: { full_name: string }; apartment: { name: string } | null } | null;
            return (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {student?.profiles?.full_name} {student?.apartment && `· ${student.apartment.name}`}
                    </p>
                    <p className="text-sm text-muted-foreground">{r.condition_description}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.start_date} {r.end_date && `— ${r.end_date}`} · {severityLabels[r.severity]}
                    </p>
                  </div>
                  <Badge variant={r.status === "ongoing" ? "outline" : "secondary"}>
                    {r.status === "ongoing" ? "مستمرة" : "تعافى"}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <Stethoscope />
          </EmptyMedia>
          <EmptyTitle>لا توجد حالات صحية مسجّلة</EmptyTitle>
          <EmptyDescription>ستظهر هنا أي حالة يسجّلها الطالب أو المشرف</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
