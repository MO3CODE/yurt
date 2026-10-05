"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { changeTargetDate, enrollCourse } from "@/app/app/learn/actions";
import { addDaysISO, daysBetweenISO } from "@/lib/date";
import { TARGET_PRESETS, paceLabel } from "@/lib/learning";
import { unwrap } from "@/lib/unwrap";

/** الانضمام للكورس (أو تغيير موعد الإنهاء إن كان منضماً): يختار الطالب الموعد ويرى معدله اليومي */
export function EnrollDialog({
  courseId,
  totalUnits,
  remainingUnits,
  today,
  currentTarget,
  trigger,
}: {
  courseId: string;
  totalUnits: number;
  remainingUnits: number;
  today: string;
  currentTarget?: string;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const editing = Boolean(currentTarget);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(currentTarget ?? addDaysISO(today, 29));
  const [isPending, startTransition] = useTransition();

  const days = Math.max(1, daysBetweenISO(today, target) + 1);
  const valid = target >= today && target <= addDaysISO(today, 366);
  const units = editing ? remainingUnits : totalUnits;

  function save() {
    startTransition(async () => {
      try {
        if (editing) await unwrap(changeTargetDate(courseId, target));
        else await unwrap(enrollCourse(courseId, target));
        toast.success(editing ? "تغيّر موعد الإنهاء" : "انضممت إلى الكورس، بالتوفيق!");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "تغيير موعد الإنهاء" : "الانضمام إلى الكورس"}</DialogTitle>
          <DialogDescription>متى تريد أن تنهي الكورس؟ ستظهر دروس كل يوم في مهامك.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {TARGET_PRESETS.map((p) => {
              const d = addDaysISO(today, p.days - 1);
              return (
                <Button key={p.days} type="button" size="sm" variant={target === d ? "default" : "outline"} onClick={() => setTarget(d)}>
                  {p.label}
                </Button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="enroll-target" className="shrink-0 font-normal text-muted-foreground">
              أو تاريخ
            </Label>
            <Input
              id="enroll-target"
              type="date"
              min={today}
              max={addDaysISO(today, 366)}
              value={target}
              onChange={(e) => e.target.value && setTarget(e.target.value)}
              className="w-44"
            />
          </div>
          {valid && units > 0 && (
            <p className="flex items-center gap-2 rounded-lg bg-muted/60 p-3 text-sm">
              <CalendarCheck className="size-4 shrink-0 text-primary" />
              {paceLabel(units / days)} تقريباً، حتى تنهي {editing ? "ما تبقّى" : "الكورس"} في موعدك.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={isPending || !valid}>
            {isPending && <Spinner />}
            {editing ? "حفظ" : "انضم"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
