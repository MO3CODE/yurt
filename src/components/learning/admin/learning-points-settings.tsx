"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { saveLearningPointsSettings } from "@/app/admin/learning/actions";
import { unwrap } from "@/lib/unwrap";

export function LearningPointsSettings({ values }: { values: { course_complete: number; writing_approved: number } }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await unwrap(saveLearningPointsSettings(formData));
        toast.success("حُفظت قيم النقاط");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
          <Label htmlFor="lp-course" className="font-normal">
            إنهاء كورس في موعده
          </Label>
          <Input id="lp-course" name="course_complete" type="number" min={0} max={1000} defaultValue={values.course_complete} className="w-20" />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
          <Label htmlFor="lp-writing" className="font-normal">
            قبول تدريب كتابة
          </Label>
          <Input id="lp-writing" name="writing_approved" type="number" min={0} max={1000} defaultValue={values.writing_approved} className="w-20" />
        </div>
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending && <Spinner />}
        حفظ
      </Button>
    </form>
  );
}
