"use client";

import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addWritingUnit, updateWritingUnit } from "@/app/admin/learning/actions";

/** إضافة تدريب كتابة أو تعديله: عنوان، تعليمات، ومواضيع (موضوع في كل سطر) */
export function WritingUnitDialog({
  courseId,
  unit,
  trigger,
}: {
  courseId: string;
  unit?: { id: string; title: string; body: string | null; topics: string[] };
  trigger: React.ReactNode;
}) {
  return (
    <CrudDialog
      trigger={trigger}
      title={unit ? "تعديل تدريب الكتابة" : "تدريب كتابة جديد"}
      description="يختار الطالب موضوعاً، يكتب بيده على الورق، ثم يرفع صورة الورقة لتراجعها الإدارة"
      action={(fd) => (unit ? updateWritingUnit(unit.id, courseId, fd) : addWritingUnit(courseId, fd))}
      submitLabel={unit ? "حفظ" : "إضافة"}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="w-title">العنوان</FieldLabel>
          <Input id="w-title" name="title" required minLength={2} maxLength={200} defaultValue={unit?.title} placeholder="Writing: My Daily Routine" />
        </Field>
        <Field>
          <FieldLabel htmlFor="w-body">التعليمات (اختياري)</FieldLabel>
          <Textarea
            id="w-body"
            name="body"
            rows={4}
            maxLength={20000}
            defaultValue={unit?.body ?? ""}
            placeholder="اكتب فقرة من ١٠٠ إلى ١٥٠ كلمة، واستعمل كلمات الدرس..."
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="w-topics">المواضيع</FieldLabel>
          <Textarea
            id="w-topics"
            name="topics"
            rows={5}
            required
            defaultValue={unit?.topics.join("\n")}
            placeholder={"My favorite place\nA day I will never forget\nWhy I chose my major"}
          />
          <FieldDescription>موضوع في كل سطر (حتى ٣٠ موضوعاً)</FieldDescription>
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
