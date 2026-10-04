"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitComplaint } from "@/app/app/complaints/actions";

const TYPES = [
  { value: "complaint", label: "شكوى" },
  { value: "suggestion", label: "مقترح" },
  { value: "academic", label: "دعم أكاديمي — مادة متعثر بها" },
];

export function NewComplaintDialog() {
  const [category, setCategory] = useState("complaint");
  const academic = category === "academic";

  async function action(formData: FormData) {
    const result = await submitComplaint(formData);
    if (result.ok && formData.get("category") === "academic") {
      toast.success("وصل طلبك إلى الدعم الأكاديمي — تتابعه من صفحة «الدعم الأكاديمي»");
    }
    return result;
  }

  return (
    <CrudDialog
      trigger={<Button><Plus /> شكوى أو مقترح جديد</Button>}
      title="تقديم شكوى أو مقترح"
      action={action}
      submitLabel="إرسال"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="category">النوع</FieldLabel>
          <Select name="category" value={category} onValueChange={(v) => v && setCategory(v)} items={TYPES}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {academic && <FieldDescription>يصل طلبك إلى فريق الدعم الأكاديمي لترتيب تقوية لك في هذه المادة.</FieldDescription>}
        </Field>
        <Field>
          <FieldLabel htmlFor="subject">{academic ? "المادة المتعثر بها" : "العنوان"}</FieldLabel>
          <Input id="subject" name="subject" required placeholder={academic ? "مثل: الرياضيات 2" : undefined} />
        </Field>
        <Field>
          <FieldLabel htmlFor="description">{academic ? "ما الصعوبة؟ (اختياري)" : "التفاصيل"}</FieldLabel>
          <Textarea
            id="description"
            name="description"
            rows={4}
            required={!academic}
            placeholder={academic ? "مثل: لا أفهم التفاضل، أو لدي اختبار قريب" : undefined}
          />
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
