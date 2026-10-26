"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { setTermFreeze } from "@/app/term-courses-actions";
import { unwrap } from "@/lib/unwrap";

/** تجميد الترم (kayıt dondurma) من ملف الطالب: لا رفع ولا مواد ولا تذكيرات له في هذا الترم */
export function TermFreezeControl({
  studentId,
  termId,
  termName,
  frozen,
  reason,
}: {
  studentId: string;
  termId: string;
  termName: string;
  frozen: boolean;
  reason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  function save(next: boolean) {
    startTransition(async () => {
      try {
        await unwrap(setTermFreeze({ studentId, termId, frozen: next, reason: text }));
        toast.success(next ? `جُمِّد ${termName}` : "أُلغي التجميد");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  if (frozen) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/[0.05] p-3 text-sm">
        <span className="flex items-center gap-2">
          <Snowflake className="size-4 text-primary" />
          <span>
            <span className="font-semibold">جمّد هذا الترم</span>
            {reason && <span className="text-muted-foreground"> — {reason}</span>}
          </span>
        </span>
        <Button variant="ghost" size="sm" disabled={isPending} onClick={() => save(false)}>
          {isPending && <Spinner />} إلغاء التجميد
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="w-fit">
            <Snowflake /> تجميد هذا الترم
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>تجميد {termName}</DialogTitle>
          <DialogDescription>
            لن يُطلب منه رفع كشف ولا تسجيل مواد هذا الترم، ولا يُحسب في نسب الرفع ولا في التذكيرات. تلغيه متى أردت.
          </DialogDescription>
        </DialogHeader>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="السبب (اختياري)، مثل: ظرف صحي" maxLength={300} />
        <DialogFooter>
          <Button onClick={() => save(true)} disabled={isPending}>
            {isPending ? <Spinner /> : <Snowflake />} تجميد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
