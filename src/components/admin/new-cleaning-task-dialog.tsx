"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCleaningTask } from "@/app/admin/cleaning/actions";

export function NewCleaningTaskDialog({
  apartments,
  facilities,
}: {
  apartments: { id: string; name: string }[];
  facilities: { id: string; name: string }[];
}) {
  const [scope, setScope] = useState<"apartment" | "facility">("apartment");

  return (
    <CrudDialog trigger={<Button><Plus /> مهمة نظافة جديدة</Button>} title="إضافة مهمة نظافة" action={createCleaningTask} submitLabel="إضافة">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="scope">النطاق</FieldLabel>
          <Select
            name="scope"
            value={scope}
            onValueChange={(v) => v && setScope(v as "apartment" | "facility")}
            items={[
              { value: "apartment", label: "شقة" },
              { value: "facility", label: "مرفق عام" },
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apartment">شقة</SelectItem>
              <SelectItem value="facility">مرفق عام</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {scope === "apartment" ? (
          <Field>
            <FieldLabel htmlFor="apartment_id">الشقة</FieldLabel>
            <Select name="apartment_id" items={apartments.map((a) => ({ value: a.id, label: a.name }))}>
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
        ) : (
          <Field>
            <FieldLabel htmlFor="facility_id">المرفق</FieldLabel>
            <Select name="facility_id" items={facilities.map((f) => ({ value: f.id, label: f.name }))}>
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
        )}

        <Field>
          <FieldLabel htmlFor="name">اسم المهمة</FieldLabel>
          <Input id="name" name="name" placeholder="مثال: المطبخ، الحمام، الصالة" required />
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
