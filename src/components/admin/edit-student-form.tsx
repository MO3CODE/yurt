"use client";

import { useTransition, useState } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { updateStudent } from "@/app/admin/students/actions";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import type { StudentStatus } from "@/lib/supabase/types";

const statusOptions: { value: StudentStatus; label: string }[] = [
  { value: "active", label: "نشط" },
  { value: "on_leave", label: "إجازة" },
  { value: "graduated", label: "متخرج" },
  { value: "withdrawn", label: "منسحب" },
];

export function EditStudentForm({
  studentId,
  apartments,
  defaults,
}: {
  studentId: string;
  apartments: { id: string; name: string }[];
  defaults: {
    apartment_id: string | null;
    university_name: string | null;
    major: string | null;
    academic_year: string | null;
    status: StudentStatus;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    notes: string | null;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [apartmentId, setApartmentId] = useState(defaults.apartment_id ?? "none");
  const [status, setStatus] = useState<StudentStatus>(defaults.status);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await unwrap(updateStudent(studentId, formData));
        toast.success("تم حفظ التغييرات");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر حفظ التغييرات");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field orientation="responsive">
          <FieldLabel htmlFor="apartment_id">الشقة</FieldLabel>
          <Select
            value={apartmentId}
            onValueChange={(v) => v && setApartmentId(v)}
            name="apartment_id"
            items={[{ value: "none", label: "بدون شقة" }, ...apartments.map((a) => ({ value: a.id, label: a.name }))]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون شقة</SelectItem>
              {apartments.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="status">الحالة</FieldLabel>
          <Select
            value={status}
            onValueChange={(v) => v && setStatus(v as StudentStatus)}
            name="status"
            items={statusOptions}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="university_name">الجامعة</FieldLabel>
          <Input id="university_name" name="university_name" defaultValue={defaults.university_name ?? ""} />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="major">التخصص</FieldLabel>
          <Input id="major" name="major" defaultValue={defaults.major ?? ""} />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="academic_year">السنة الدراسية</FieldLabel>
          <Input id="academic_year" name="academic_year" defaultValue={defaults.academic_year ?? ""} />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="emergency_contact_name">جهة اتصال الطوارئ</FieldLabel>
          <Input id="emergency_contact_name" name="emergency_contact_name" defaultValue={defaults.emergency_contact_name ?? ""} />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="emergency_contact_phone">رقم الطوارئ</FieldLabel>
          <Input id="emergency_contact_phone" name="emergency_contact_phone" defaultValue={defaults.emergency_contact_phone ?? ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">ملاحظات</FieldLabel>
          <Textarea id="notes" name="notes" rows={3} defaultValue={defaults.notes ?? ""} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending && <Spinner />}
        حفظ التغييرات
      </Button>
    </form>
  );
}
