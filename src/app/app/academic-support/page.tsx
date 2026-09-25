import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, GraduationCap } from "lucide-react";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { requestAcademicSupport } from "./actions";

const statusLabels: Record<string, string> = {
  open: "بانتظار المتابعة",
  assigned: "تم التكليف",
  in_progress: "قيد المتابعة",
  resolved: "تم الحل",
  closed: "مغلقة",
};

export default async function AcademicSupportPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("academic_support_requests")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader
        title="الدعم الأكاديمي"
        description="اطلب تقوية دراسية بأي مادة"
        action={
          <CrudDialog
            trigger={<Button><Plus /> طلب تقوية</Button>}
            title="طلب دعم أكاديمي"
            action={requestAcademicSupport}
            submitLabel="إرسال الطلب"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="subject">المادة</FieldLabel>
                <Input id="subject" name="subject" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">تفاصيل إضافية (اختياري)</FieldLabel>
                <Textarea id="description" name="description" rows={3} />
              </Field>
            </FieldGroup>
          </CrudDialog>
        }
      />

      {requests && requests.length > 0 ? (
        <div className="flex flex-col gap-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.subject}</span>
                  <Badge variant="secondary">{statusLabels[r.status]}</Badge>
                </div>
                {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                {r.assigned_to_name && <p className="text-sm">المتابع: {r.assigned_to_name}</p>}
                {r.admin_notes && (
                  <p className="rounded-lg bg-muted/60 p-2.5 text-sm">
                    <span className="font-medium">ملاحظة الإدارة: </span>
                    {r.admin_notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <GraduationCap />
          </EmptyMedia>
          <EmptyTitle>لا توجد طلبات دعم أكاديمي</EmptyTitle>
          <EmptyDescription>اطلب تقوية بأي مادة تحتاج مساعدة فيها</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
