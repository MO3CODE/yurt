"use client";

import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createTerm, updateTerm } from "@/app/admin/academic/grades-actions";
import type { AcademicTerm } from "@/lib/grades";

/** ترم جديد أو تعديله: الاسم وفترتا رفع النصفي والنهائي */
export function TermFormDialog({ trigger, term }: { trigger: React.ReactNode; term?: AcademicTerm }) {
  return (
    <CrudDialog
      trigger={trigger}
      title={term ? "تعديل الترم" : "ترم جديد"}
      description={term ? undefined : "يصل للطلاب إشعار بفترتي الرفع، وتظهر لهم مهمة الرفع حين تُفتح الفترة"}
      action={(fd) => (term ? updateTerm(term.id, fd) : createTerm(fd))}
      submitLabel={term ? "حفظ" : "فتح الترم"}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="term-name">اسم الترم</FieldLabel>
          <Input id="term-name" name="name" required minLength={2} maxLength={80} defaultValue={term?.name} placeholder="الخريف ٢٠٢٦ (Güz)" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="mid-from">رفع النصفي من</FieldLabel>
            <Input id="mid-from" name="midterm_from" type="date" required defaultValue={term?.midterm_from} />
          </Field>
          <Field>
            <FieldLabel htmlFor="mid-to">إلى</FieldLabel>
            <Input id="mid-to" name="midterm_to" type="date" required defaultValue={term?.midterm_to} />
          </Field>
          <Field>
            <FieldLabel htmlFor="fin-from">رفع النهائي من</FieldLabel>
            <Input id="fin-from" name="final_from" type="date" required defaultValue={term?.final_from} />
          </Field>
          <Field>
            <FieldLabel htmlFor="fin-to">إلى</FieldLabel>
            <Input id="fin-to" name="final_to" type="date" required defaultValue={term?.final_to} />
          </Field>
        </div>
      </FieldGroup>
    </CrudDialog>
  );
}
