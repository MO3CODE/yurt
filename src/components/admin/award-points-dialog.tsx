"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { awardPoints } from "@/app/admin/points/actions";

const categories = [
  { value: "prayer", label: "الصلاة" },
  { value: "quran", label: "الورد القرآني" },
  { value: "attendance", label: "الحضور" },
  { value: "cleaning", label: "النظافة" },
  { value: "academic", label: "أكاديمي" },
  { value: "other", label: "أخرى" },
];

export function AwardPointsDialog({ students }: { students: { id: string; full_name: string }[] }) {
  return (
    <CrudDialog trigger={<Button><Plus /> منح نقاط</Button>} title="منح نقاط لطالب" action={awardPoints} submitLabel="منح">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="student_id">الطالب</FieldLabel>
          <Select name="student_id">
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
        <Field orientation="responsive">
          <FieldLabel htmlFor="category">التصنيف</FieldLabel>
          <Select name="category" defaultValue="other">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="points">عدد النقاط (سالب للخصم)</FieldLabel>
          <Input id="points" name="points" type="number" defaultValue={5} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="reason">السبب (اختياري)</FieldLabel>
          <Input id="reason" name="reason" />
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
