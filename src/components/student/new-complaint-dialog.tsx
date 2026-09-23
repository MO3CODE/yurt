"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitComplaint } from "@/app/app/complaints/actions";

export function NewComplaintDialog() {
  return (
    <CrudDialog
      trigger={<Button><Plus /> شكوى أو مقترح جديد</Button>}
      title="تقديم شكوى أو مقترح"
      action={submitComplaint}
      submitLabel="إرسال"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="category">النوع</FieldLabel>
          <Select name="category" defaultValue="complaint">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="complaint">شكوى</SelectItem>
              <SelectItem value="suggestion">مقترح</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="subject">العنوان</FieldLabel>
          <Input id="subject" name="subject" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="description">التفاصيل</FieldLabel>
          <Textarea id="description" name="description" rows={4} required />
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
