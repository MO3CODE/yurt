"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { saveQuranPointsSettings } from "@/app/admin/points/actions";
import { unwrap } from "@/lib/unwrap";

export type QuranPointsValues = { wird_goal: number; streak7: number; streak30: number; khatma: number; adhkar: number };

const FIELDS: { name: keyof QuranPointsValues; label: string }[] = [
  { name: "wird_goal", label: "إتمام الورد اليومي" },
  { name: "streak7", label: "كل ٧ أيام متتالية" },
  { name: "streak30", label: "كل ٣٠ يوماً متتالياً" },
  { name: "khatma", label: "ختمة كاملة" },
  { name: "adhkar", label: "أذكار الصباح أو المساء (لكل منهما)" },
];

/** النقاط التي تُمنح تلقائياً للطالب؛ ٠ يوقف البند */
export function QuranPointsSettings({ values }: { values: QuranPointsValues }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await unwrap(saveQuranPointsSettings(formData));
        toast.success("حُفظت قيم النقاط التلقائية");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.name} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
            <Label htmlFor={`qp-${f.name}`} className="font-normal">
              {f.label}
            </Label>
            <Input id={`qp-${f.name}`} name={f.name} type="number" min={0} max={1000} defaultValue={values[f.name]} className="w-20" />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        يُحسب اليوم مكتملاً إذا بلغ الطالب هدفه اليومي (المنصة والمصحف الورقي معاً)، ومن لا هدف له تكفيه أي قراءة. اكتب ٠ لإيقاف أي بند.
      </p>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending && <Spinner />}
        حفظ
      </Button>
    </form>
  );
}
