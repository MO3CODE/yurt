"use client";

import { useTransition } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { logWird } from "@/app/app/quran/actions";
import { toast } from "sonner";

export function WirdForm({
  date,
  defaults,
}: {
  date: string;
  defaults: { range_description: string; pages?: number; memorization: boolean; note: string };
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("record_date", date);
    startTransition(async () => {
      try {
        await logWird(formData);
        toast.success("تم حفظ الورد");
      } catch {
        toast.error("تعذّر الحفظ");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="range_description">الورد (مثال: الكهف ١-٢٠)</FieldLabel>
          <Input id="range_description" name="range_description" defaultValue={defaults.range_description} />
        </Field>
        <Field orientation="responsive">
          <FieldLabel htmlFor="pages">عدد الصفحات</FieldLabel>
          <Input id="pages" name="pages" type="number" step="0.5" defaultValue={defaults.pages} />
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="memorization" name="memorization" defaultChecked={defaults.memorization} />
          <FieldLabel htmlFor="memorization" className="font-normal">
            كان معي حفظ اليوم
          </FieldLabel>
        </Field>
        <Field>
          <FieldLabel htmlFor="note">ملاحظة (اختياري)</FieldLabel>
          <Textarea id="note" name="note" rows={2} defaultValue={defaults.note} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending && <Spinner />}
        حفظ
      </Button>
    </form>
  );
}
