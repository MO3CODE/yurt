"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, BadgeCheck, Banknote, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { approveAwards, markAwardPaid, setAwardCancelled } from "@/app/admin/academic/awards-actions";
import { buildXlsx } from "@/lib/xlsx-lite";
import { unwrap } from "@/lib/unwrap";
import type { AwardStatus } from "@/lib/scholarship";

function useRun() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>, ok: string, after?: () => void) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        after?.();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر التنفيذ");
      }
    });
  return { isPending, run };
}

export function ApproveAllAwardsButton({ termId, count }: { termId: string; count: number }) {
  const { isPending, run } = useRun();
  return (
    <Button disabled={isPending || count === 0} onClick={() => run(() => unwrap(approveAwards({ termId })), `اعتُمدت ${count} جائزة`)}>
      {isPending ? <Spinner /> : <BadgeCheck />} اعتماد المستحقة ({count})
    </Button>
  );
}

export function AwardRowActions({ id, termId, status, studentName, today }: { id: string; termId: string; status: AwardStatus; studentName: string; today: string }) {
  const { isPending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState("تحويل بنكي");
  const [ref, setRef] = useState("");

  if (status === "paid") return null;
  if (status === "cancelled") {
    return (
      <Button variant="ghost" size="sm" disabled={isPending} onClick={() => run(() => unwrap(setAwardCancelled(id, false)), "استُرجعت الجائزة")}>
        <RotateCcw /> استرجاع
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {status === "eligible" && (
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => run(() => unwrap(approveAwards({ termId, ids: [id] })), `اعتُمدت جائزة ${studentName}`)}>
          <BadgeCheck /> اعتماد
        </Button>
      )}
      {status === "approved" && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm">
                <Banknote /> تسجيل الصرف
              </Button>
            }
          />
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>صرف جائزة {studentName}</DialogTitle>
              <DialogDescription>بعد تسجيل الصرف لا تتغير الجائزة ولو أُعيد الحساب.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`pa-${id}`}>تاريخ الصرف</Label>
                <Input id={`pa-${id}`} type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`pm-${id}`}>طريقة الدفع</Label>
                <Input id={`pm-${id}`} value={method} onChange={(e) => setMethod(e.target.value)} maxLength={60} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`pr-${id}`}>مرجع العملية (اختياري)</Label>
                <Input id={`pr-${id}`} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} dir="ltr" />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={isPending}
                onClick={() => run(() => unwrap(markAwardPaid({ id, paidAt, method, ref })), `سُجّل صرف جائزة ${studentName}`, () => setOpen(false))}
              >
                {isPending ? <Spinner /> : <Banknote />} تسجيل
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Button variant="ghost" size="icon-sm" aria-label="إلغاء الجائزة" disabled={isPending} onClick={() => run(() => unwrap(setAwardCancelled(id, true)), "أُلغيت الجائزة")}>
        <Ban />
      </Button>
    </div>
  );
}

/** كشف صرف الجوائز Excel */
export function AwardsExportButton({ fileName, rows }: { fileName: string; rows: string[][] }) {
  return (
    <Button
      variant="outline"
      disabled={rows.length <= 1}
      onClick={() => {
        const bytes = buildXlsx(rows, { sheetName: "الجوائز", widths: [28, 22, 12, 14, 12, 10, 12, 14, 18] });
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download /> تصدير Excel
    </Button>
  );
}
