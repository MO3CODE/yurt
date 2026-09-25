"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Shuffle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/action-result";
import { unwrap } from "@/lib/unwrap";
import { toast } from "sonner";

/** شريط التوزيع التلقائي: شرح الدوران + «وزّع الآن» + «إعادة التوزيع» بتأكيد */
export function AutoScheduleBar({
  weekLabel,
  scopeLabel,
  generate,
}: {
  weekLabel: string;
  /** «شقتك» أو «كل الشقق» */
  scopeLabel: string;
  generate: (rebalance: boolean) => Promise<ActionResult<number>>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run(rebalance: boolean) {
    startTransition(async () => {
      try {
        const count = await unwrap(generate(rebalance));
        toast.success(
          rebalance
            ? `أُعيد توزيع ${count} مهمة`
            : count > 0
              ? `وُزّعت ${count} مهمة جديدة`
              : "كل المهام موزّعة مسبقاً لهذا الأسبوع"
        );
        setConfirmOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر التوزيع");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">التوزيع تلقائي — أسبوع {weekLabel}</span>
          <span className="max-w-xl text-sm text-muted-foreground">
            تدور المهام أسبوعياً على طلاب الشقة النشطين فيمرّ كل طالب على كل مهمة بالتناوب. يُحدَّث الجدول كل ليلة، ولا يلمس
            أي تعديل يدوي تجريه على طالب مهمة.
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => run(false)}>
          {isPending ? <Spinner /> : <RefreshCw />}
          وزّع الآن
        </Button>
        <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setConfirmOpen(true)}>
          <Shuffle /> إعادة التوزيع
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إعادة توزيع {scopeLabel}؟</DialogTitle>
            <DialogDescription>
              تُعاد جدولة كل مهام هذا الأسبوع التي لم تُنفَّذ بعد حسب الدوران التلقائي، وتُلغى التعديلات اليدوية عليها. المهام
              المنجزة أو الفائتة تبقى كما هي.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button disabled={isPending} onClick={() => run(true)}>
              {isPending && <Spinner />}
              إعادة التوزيع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
