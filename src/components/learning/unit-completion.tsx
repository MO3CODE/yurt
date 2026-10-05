"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { completeUnit, uncompleteUnit } from "@/app/app/learn/actions";
import { arNum } from "@/lib/quran";

/** إتمام الدرس وإلغاؤه (مشترك بين الفيديو والقراءة والكلمات) */
export function useUnitCompletion({
  unitId,
  courseId,
  initialDone,
  nextHref,
}: {
  unitId: string;
  courseId: string;
  initialDone: boolean;
  nextHref: string | null;
}) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [isPending, startTransition] = useTransition();
  const doneRef = useRef(initialDone);

  function markDone(message = "سُجّل الدرس مكتملاً") {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
    startTransition(async () => {
      const r = await completeUnit(unitId, courseId);
      if (!r.ok) {
        doneRef.current = false;
        setDone(false);
        toast.error(r.error);
        return;
      }
      if (r.data.course_completed) {
        toast.success(`أنهيت الكورس كاملاً، بارك الله فيك!${r.data.points > 0 ? ` +${arNum(r.data.points)} نقطة` : ""}`);
      } else {
        toast.success(message, {
          action: nextHref ? { label: "الدرس التالي", onClick: () => router.push(nextHref) } : undefined,
        });
      }
      router.refresh();
    });
  }

  function undo() {
    startTransition(async () => {
      const r = await uncompleteUnit(unitId, courseId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      doneRef.current = false;
      setDone(false);
      router.refresh();
    });
  }

  return { done, isPending, markDone, undo };
}

/** السابق/التالي + زر الإتمام أو حالة «مكتمل» */
export function UnitNavBar({
  done,
  isPending,
  onComplete,
  onUndo,
  nextHref,
  prevHref,
  completeLabel = "أنهيت الدرس",
}: {
  done: boolean;
  isPending: boolean;
  onComplete: () => void;
  onUndo: () => void;
  nextHref: string | null;
  prevHref: string | null;
  completeLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-2">
        {prevHref && (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={prevHref} />}>
            <ChevronRight /> السابق
          </Button>
        )}
        {nextHref && (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={nextHref} />}>
            التالي <ChevronLeft />
          </Button>
        )}
      </div>
      {done ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" /> مكتمل
          </span>
          <Button variant="ghost" size="sm" onClick={onUndo} disabled={isPending} className="text-muted-foreground">
            <RotateCcw /> إلغاء
          </Button>
        </div>
      ) : (
        <Button onClick={onComplete} disabled={isPending}>
          {isPending ? <Spinner /> : <CheckCircle2 />} {completeLabel}
        </Button>
      )}
    </div>
  );
}
