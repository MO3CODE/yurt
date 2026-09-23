"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createNotification } from "@/app/admin/notifications/actions";

export function NewNotificationDialog({
  apartments,
  students,
}: {
  apartments: { id: string; name: string }[];
  students: { id: string; full_name: string }[];
}) {
  const [target, setTarget] = useState("all");

  return (
    <CrudDialog
      trigger={<Button><Plus /> إشعار جديد</Button>}
      title="إرسال إشعار"
      action={createNotification}
      submitLabel="إرسال"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="title">العنوان</FieldLabel>
          <Input id="title" name="title" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="body">المحتوى</FieldLabel>
          <Textarea id="body" name="body" rows={3} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="target_type">إرسال إلى</FieldLabel>
          <Select
            name="target_type"
            value={target}
            onValueChange={(v) => v && setTarget(v)}
            items={[
              { value: "all", label: "كل الطلاب" },
              { value: "apartment", label: "شقة معينة" },
              { value: "student", label: "طالب معين" },
              { value: "role", label: "فئة إدارية" },
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الطلاب</SelectItem>
              <SelectItem value="apartment">شقة معينة</SelectItem>
              <SelectItem value="student">طالب معين</SelectItem>
              <SelectItem value="role">فئة إدارية</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {target === "apartment" && (
          <Field>
            <FieldLabel htmlFor="target_apartment_id">الشقة</FieldLabel>
            <Select name="target_apartment_id" items={apartments.map((a) => ({ value: a.id, label: a.name }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر الشقة" />
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
        )}

        {target === "student" && (
          <Field>
            <FieldLabel htmlFor="target_student_id">الطالب</FieldLabel>
            <Select name="target_student_id" items={students.map((s) => ({ value: s.id, label: s.full_name }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر الطالب" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {target === "role" && (
          <Field>
            <FieldLabel htmlFor="target_role">الفئة</FieldLabel>
            <Select
              name="target_role"
              items={[
                { value: "student", label: "الطلاب" },
                { value: "admin", label: "الإداريون" },
              ]}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">الطلاب</SelectItem>
                <SelectItem value="admin">الإداريون</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </FieldGroup>
    </CrudDialog>
  );
}
