"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportFacilityIssue } from "@/app/admin/facilities/actions";

export function ReportFacilityIssueDialog({ facilities }: { facilities: { id: string; name: string }[] }) {
  return (
    <CrudDialog
      trigger={
        <Button variant="outline">
          <AlertTriangle /> بلاغ عطل
        </Button>
      }
      title="بلاغ عطل أو مشكلة بمرفق"
      action={reportFacilityIssue}
      submitLabel="إرسال البلاغ"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="facility_id">المرفق</FieldLabel>
          <Select name="facility_id">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر المرفق" />
            </SelectTrigger>
            <SelectContent>
              {facilities.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="description">وصف المشكلة</FieldLabel>
          <Textarea id="description" name="description" rows={3} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="priority">الأولوية</FieldLabel>
          <Select name="priority" defaultValue="medium">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">منخفضة</SelectItem>
              <SelectItem value="medium">متوسطة</SelectItem>
              <SelectItem value="high">عالية</SelectItem>
              <SelectItem value="urgent">عاجلة</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
