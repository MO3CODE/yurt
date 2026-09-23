"use client";

import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createApartment } from "@/app/admin/apartments/actions";

export function NewApartmentDialog({ trigger }: { trigger: React.ReactNode }) {
  return (
    <CrudDialog trigger={trigger} title="إضافة شقة جديدة" action={createApartment} submitLabel="إضافة">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">اسم الشقة</FieldLabel>
          <Input id="name" name="name" placeholder="مثال: شقة 3" required />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="floor_number">رقم الطابق</FieldLabel>
          <Input id="floor_number" name="floor_number" type="number" required />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="capacity">السعة (عدد الطلاب)</FieldLabel>
          <Input id="capacity" name="capacity" type="number" defaultValue={4} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">ملاحظات (اختياري)</FieldLabel>
          <Textarea id="notes" name="notes" rows={2} />
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
