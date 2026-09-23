"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTask } from "@/app/app/tasks/actions";

export function NewTaskDialog() {
  return (
    <CrudDialog trigger={<Button><Plus /> مهمة جديدة</Button>} title="إضافة مهمة" action={createTask} submitLabel="إضافة">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="title">العنوان</FieldLabel>
          <Input id="title" name="title" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="description">تفاصيل (اختياري)</FieldLabel>
          <Textarea id="description" name="description" rows={2} />
        </Field>
        <Field>
          <FieldLabel htmlFor="due_date">الموعد (اختياري)</FieldLabel>
          <Input id="due_date" name="due_date" type="date" />
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
