"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, FileText } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { reviewGradeReport } from "@/app/admin/academic/grades-actions";
import { KIND_LABELS, parseGpa, type ReportKind } from "@/lib/grades";
import { unwrap } from "@/lib/unwrap";

export type AdminReport = {
  id: string;
  kind: ReportKind;
  status: "pending" | "reviewed";
  termGpa: number | null;
  cumulativeGpa: number | null;
  verifiedTermGpa: number | null;
  verifiedCumulativeGpa: number | null;
  note: string | null;
  adminNote: string | null;
  files: { url: string; isPdf: boolean }[];
};

/** مراجعة كشف: الملفات بجانب ما كتبه الطالب، والإدارة تؤكّد أو تصحّح المعدل */
export function ReviewGradeDialog({ studentName, report, trigger }: { studentName: string; report: AdminReport; trigger: React.ReactElement }) {
  const router = useRouter();
  const isFinal = report.kind === "final";
  const [open, setOpen] = useState(false);
  const [termGpa, setTermGpa] = useState(String(report.verifiedTermGpa ?? report.termGpa ?? ""));
  const [cumGpa, setCumGpa] = useState(String(report.verifiedCumulativeGpa ?? report.cumulativeGpa ?? ""));
  const [note, setNote] = useState(report.adminNote ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    const t = isFinal ? parseGpa(termGpa) : null;
    const c = isFinal ? parseGpa(cumGpa) : null;
    if ([t, c].some((n) => n !== null && (Number.isNaN(n) || n < 0 || n > 4))) return toast.error("المعدل رقم بين ٠ و٤");
    startTransition(async () => {
      try {
        await unwrap(reviewGradeReport({ id: report.id, termGpa: t, cumulativeGpa: c, note }));
        toast.success(c !== null ? `أُكّد كشف ${studentName} وتحدّث معدله في المتابعة` : `أُكّد كشف ${studentName}`);
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {studentName} — كشف {KIND_LABELS[report.kind]}
          </DialogTitle>
          <DialogDescription>افتح الملف، وتأكد من المعدل قبل الحفظ</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {report.files.map((f, i) =>
              f.isPdf ? (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
                  <FileText className="size-4" /> فتح PDF {i + 1} <ExternalLink className="size-3.5 text-muted-foreground" />
                </a>
              ) : (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border" title="فتح بالحجم الكامل">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`الصفحة ${i + 1}`} className="h-44 w-auto max-w-full object-contain" />
                </a>
              )
            )}
          </div>
          {report.note && <p className="rounded-lg bg-muted/60 p-2.5 text-sm">ملاحظة الطالب: {report.note}</p>}

          {isFinal && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rv-term">المعدل الفصلي (ANO)</Label>
                <Input id="rv-term" value={termGpa} onChange={(e) => setTermGpa(e.target.value)} inputMode="decimal" dir="ltr" />
                {report.termGpa !== null && <span className="text-[11px] text-muted-foreground">كتب الطالب: {report.termGpa}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rv-cum">المعدل التراكمي (GANO)</Label>
                <Input id="rv-cum" value={cumGpa} onChange={(e) => setCumGpa(e.target.value)} inputMode="decimal" dir="ltr" />
                {report.cumulativeGpa !== null && <span className="text-[11px] text-muted-foreground">كتب الطالب: {report.cumulativeGpa}</span>}
              </div>
            </div>
          )}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} placeholder="ملاحظة للطالب (اختياري): مواد تحتاج تقوية، تشجيع…" />
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={isPending}>
            {isPending ? <Spinner /> : <CheckCircle2 />} {report.status === "reviewed" ? "حفظ التعديل" : "تأكيد الكشف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
