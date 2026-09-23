"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createFacility } from "@/app/admin/facilities/actions";

export function NewFacilityDialog() {
  return (
    <CrudDialog trigger={<Button><Plus /> إضافة مرفق</Button>} title="إضافة مرفق جديد" action={createFacility} submitLabel="إضافة">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">اسم المرفق</FieldLabel>
          <Input id="name" name="name" placeholder="مثال: المصلى، الديوانية، الحوش، المصعد" required />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="facility_type">النوع (اختياري)</FieldLabel>
          <Input id="facility_type" name="facility_type" />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="floor_number">الطابق (اختياري)</FieldLabel>
          <Input id="floor_number" name="floor_number" type="number" />
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
