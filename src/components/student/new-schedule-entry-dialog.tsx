"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addScheduleEntry } from "@/app/app/schedule/actions";
import { dayName } from "@/lib/date";

export function NewScheduleEntryDialog() {
  return (
    <CrudDialog
      trigger={<Button><Plus /> إضافة محاضرة</Button>}
      title="إضافة محاضرة للجدول الأسبوعي"
      action={addScheduleEntry}
      submitLabel="إضافة"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="day_of_week">اليوم</FieldLabel>
          <Select
            name="day_of_week"
            defaultValue="0"
            items={Array.from({ length: 7 }, (_, i) => ({ value: String(i), label: dayName(i) }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 7 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {dayName(i)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="start_time">من الساعة</FieldLabel>
          <Input id="start_time" name="start_time" type="time" required />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="end_time">إلى الساعة</FieldLabel>
          <Input id="end_time" name="end_time" type="time" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="course_name">اسم المادة</FieldLabel>
          <Input id="course_name" name="course_name" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="location">القاعة/الموقع (اختياري)</FieldLabel>
          <Input id="location" name="location" />
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
