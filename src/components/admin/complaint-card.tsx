"use client";

import { useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  new: "جديدة",
  triaged: "قيد المراجعة",
  in_progress: "قيد المعالجة",
  escalated: "مُصعَّدة",
  resolved: "تم الحل",
  rejected: "مرفوضة",
};

export function ComplaintCard({
  complaint,
  studentName,
  apartmentName,
  statusOptions,
  responseFieldName,
  onSave,
}: {
  complaint: {
    id: string;
    subject: string;
    description: string;
    category: string;
    status: string;
    admin_response: string | null;
    supervisor_response: string | null;
  };
  studentName: string;
  apartmentName?: string;
  statusOptions: string[];
  responseFieldName: "admin_response" | "supervisor_response";
  onSave: (complaintId: string, formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await onSave(complaint.id, formData);
        toast.success("تم الحفظ");
      } catch {
        toast.error("تعذّر الحفظ");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{complaint.subject}</p>
            <p className="text-xs text-muted-foreground">
              {studentName} {apartmentName && `· ${apartmentName}`} · {complaint.category === "complaint" ? "شكوى" : "مقترح"}
            </p>
          </div>
          <Badge variant="secondary">{statusLabels[complaint.status]}</Badge>
        </div>
        <p className="text-sm">{complaint.description}</p>

        <form action={handleSubmit} className="flex flex-col gap-2 border-t pt-3">
          <Select name="status" defaultValue={complaint.status}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            name={responseFieldName}
            placeholder="اكتب رداً (اختياري)"
            rows={2}
            defaultValue={(responseFieldName === "admin_response" ? complaint.admin_response : complaint.supervisor_response) ?? ""}
          />
          <Button type="submit" size="sm" disabled={isPending} className="w-fit">
            {isPending && <Spinner />}
            حفظ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
