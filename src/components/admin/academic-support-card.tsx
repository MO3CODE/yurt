"use client";

import { useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { updateAcademicSupportRequest } from "@/app/admin/academic-support/actions";

const statusLabels: Record<string, string> = {
  open: "بانتظار المتابعة",
  assigned: "تم التكليف",
  in_progress: "قيد المتابعة",
  resolved: "تم الحل",
  closed: "مغلقة",
};

export function AcademicSupportCard({
  request,
  studentName,
}: {
  request: {
    id: string;
    subject: string;
    description: string | null;
    status: string;
    assigned_to_name: string | null;
    admin_notes: string | null;
  };
  studentName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateAcademicSupportRequest(request.id, formData);
        toast.success("تم التحديث");
      } catch {
        toast.error("تعذّر التحديث");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{request.subject}</p>
            <p className="text-xs text-muted-foreground">{studentName}</p>
          </div>
          <Badge variant="secondary">{statusLabels[request.status]}</Badge>
        </div>
        {request.description && <p className="text-sm text-muted-foreground">{request.description}</p>}

        <form action={handleSubmit} className="flex flex-col gap-2 border-t pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select name="status" defaultValue={request.status}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input name="assigned_to_name" placeholder="اسم المتابع" defaultValue={request.assigned_to_name ?? ""} />
          </div>
          <Textarea name="admin_notes" placeholder="ملاحظات الإدارة" rows={2} defaultValue={request.admin_notes ?? ""} />
          <Button type="submit" size="sm" disabled={isPending} className="w-fit">
            {isPending && <Spinner />}
            حفظ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
