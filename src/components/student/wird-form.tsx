"use client";

import { useTransition } from "react";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { logWird } from "@/app/app/quran/actions";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";

export function WirdForm({
  date,
  defaults,
}: {
  date: string;
  defaults: { range_description: string; pages?: number; reached_page?: number; memorization: boolean; note: string };
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("record_date", date);
    startTransition(async () => {
      try {
        const { points } = await unwrap(logWird(formData));
        toast.success(points > 0 ? `تم حفظ الورد، +${points} نقطة` : "تم حفظ الورد");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
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
        <Field orientation="responsive">
          <FieldContent>
            <FieldLabel htmlFor="reached_page">وصلت إلى صفحة (اختياري)</FieldLabel>
            <FieldDescription>تنقل علامة ختمتك إلى ما بعد هذه الصفحة</FieldDescription>
          </FieldContent>
          <Input
            id="reached_page"
            name="reached_page"
            type="number"
            inputMode="numeric"
            min={1}
            max={604}
            placeholder="١ – ٦٠٤"
            defaultValue={defaults.reached_page}
          />
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
