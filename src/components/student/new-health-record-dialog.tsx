"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportHealthIssue } from "@/app/app/health/actions";

export function NewHealthRecordDialog() {
  return (
    <CrudDialog
      trigger={<Button><Plus /> تسجيل حالة صحية</Button>}
      title="تسجيل وعكة صحية"
      description="راح تصل الإدارة إشعار لمتابعتك"
      action={reportHealthIssue}
      submitLabel="حفظ"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="condition_description">وصف الحالة</FieldLabel>
          <Textarea id="condition_description" name="condition_description" rows={3} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="severity">الشدة</FieldLabel>
          <Select
            name="severity"
            defaultValue="mild"
            items={[
              { value: "mild", label: "بسيطة" },
              { value: "moderate", label: "متوسطة" },
              { value: "severe", label: "شديدة" },
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mild">بسيطة</SelectItem>
              <SelectItem value="moderate">متوسطة</SelectItem>
              <SelectItem value="severe">شديدة</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
