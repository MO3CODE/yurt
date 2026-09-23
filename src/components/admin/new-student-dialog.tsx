"use client";

import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createStudent } from "@/app/admin/students/actions";

export function NewStudentDialog({
  trigger,
  apartments,
}: {
  trigger: React.ReactNode;
  apartments: { id: string; name: string }[];
}) {
  return (
    <CrudDialog
      trigger={trigger}
      title="إضافة طالب جديد"
      description="سيتم إنشاء حساب له وإرسال دعوة على بريده الإلكتروني"
      action={createStudent}
      submitLabel="إضافة الطالب"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="full_name">الاسم الكامل</FieldLabel>
          <Input id="full_name" name="full_name" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">البريد الإلكتروني</FieldLabel>
          <Input id="email" name="email" type="email" required />
          <FieldDescription>راح تُرسل له دعوة لتفعيل الحساب وتعيين كلمة المرور</FieldDescription>
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="phone">رقم الجوال (اختياري)</FieldLabel>
          <Input id="phone" name="phone" />
        </Field>
        <Field>
          <FieldLabel htmlFor="apartment_id">الشقة</FieldLabel>
          <Select name="apartment_id">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر الشقة (اختياري الآن)" />
            </SelectTrigger>
            <SelectContent>
              {apartments.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="university_name">الجامعة</FieldLabel>
          <Input id="university_name" name="university_name" />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="major">التخصص</FieldLabel>
          <Input id="major" name="major" />
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
