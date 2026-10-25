"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Undo2 } from "lucide-react";
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
import { CourseRowsEditor } from "@/components/grades/course-rows-editor";
import { reviewGradeReport, returnGradeReport } from "@/app/admin/academic/grades-actions";
import { emptyCourse, parseCourses, previewCourses, type CourseDraft } from "@/lib/course-drafts";
import { KIND_LABELS, formatGpa, parseGpa, type ReportKind } from "@/lib/grades";
import { STATUS_META, isMismatch, type GradeScale, type ScholarshipSettings } from "@/lib/scholarship";
import { unwrap } from "@/lib/unwrap";

export type AdminReport = {
  id: string;
  kind: ReportKind;
  status: "pending" | "returned" | "reviewed";
  termGpa: number | null;
  cumulativeGpa: number | null;
  verifiedTermGpa: number | null;
  verifiedCumulativeGpa: number | null;
  note: string | null;
  adminNote: string | null;
  files: { url: string; isPdf: boolean }[];
  courses: CourseDraft[];
};

/** مراجعة كشف: الملفات بجانب المواد وما كتبه الطالب، والإدارة تؤكّد (أو تصحّح) أو تعيده للطالب */
export function ReviewGradeDialog({
  studentName,
  report,
  scale,
  settings,
  trigger,
}: {
  studentName: string;
  report: AdminReport;
  scale: GradeScale;
  settings: ScholarshipSettings;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const isFinal = report.kind === "final";
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CourseDraft[]>(report.courses.length ? report.courses : [emptyCourse()]);
  const [termGpa, setTermGpa] = useState(String(report.verifiedTermGpa ?? report.termGpa ?? ""));
  const [cumGpa, setCumGpa] = useState(String(report.verifiedCumulativeGpa ?? report.cumulativeGpa ?? ""));
  const [note, setNote] = useState(report.adminNote ?? "");
  const [isPending, startTransition] = useTransition();

  const { gpa: calc } = previewCourses(rows, report.kind, scale, settings);
  const enteredTerm = parseGpa(termGpa);
  const mismatch = isFinal && isMismatch(calc, enteredTerm !== null && !Number.isNaN(enteredTerm) ? enteredTerm : null, settings);
  const coursesChanged = JSON.stringify(rows) !== JSON.stringify(report.courses);

  function save() {
    const t = isFinal ? parseGpa(termGpa) : null;
    const c = isFinal ? parseGpa(cumGpa) : null;
    if ([t, c].some((n) => n !== null && (Number.isNaN(n) || n < 0 || n > 4))) return toast.error("المعدل رقم بين ٠ و٤");
    let courses = null;
    if (coursesChanged || report.courses.length === 0) {
      const parsed = parseCourses(rows, report.kind);
      if ("error" in parsed) return toast.error(parsed.error);
      courses = parsed.courses;
    }
    startTransition(async () => {
      try {
        const summary = await unwrap(reviewGradeReport({ id: report.id, termGpa: t, cumulativeGpa: c, note, courses }));
        const parts = [`أُكّد كشف ${studentName}`];
        if (summary.status) parts.push(`الحالة: ${STATUS_META[summary.status].label}`);
        if (summary.supportCount) parts.push(`${summary.supportCount} مادة تحتاج دعماً`);
        toast.success(parts.join(" · "));
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  function sendBack() {
    startTransition(async () => {
      try {
        await unwrap(returnGradeReport({ id: report.id, note }));
        toast.success(`أُعيد الكشف إلى ${studentName} مع ملاحظتك`);
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّرت الإعادة");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {studentName} — كشف {KIND_LABELS[report.kind]}
          </DialogTitle>
          <DialogDescription>قارن المواد بالملف، وتأكد من المعدل قبل التأكيد. التأكيد يحسب حالة الطالب وطلبات الدعم والجائزة.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            {report.files.map((f, i) =>
              f.isPdf ? (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
                  <FileText className="size-4" /> فتح PDF {i + 1} <ExternalLink className="size-3.5 text-muted-foreground" />
                </a>
              ) : (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border" title="فتح بالحجم الكامل">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`الصفحة ${i + 1}`} className="max-h-96 w-full object-contain" />
                </a>
              )
            )}
            {report.note && <p className="rounded-lg bg-muted/60 p-2.5 text-sm">ملاحظة الطالب: {report.note}</p>}
          </div>

          <div className="flex flex-col gap-4">
            <CourseRowsEditor rows={rows} onChange={setRows} kind={report.kind} scale={scale} settings={settings} allowHelp disabled={isPending} />

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
            {mismatch && (
              <p className="flex gap-2 rounded-lg bg-destructive/[0.08] p-2.5 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  تعارض في المعدل: المحسوب من المواد <span className="font-semibold tabular-nums">{formatGpa(calc)}</span> والمكتوب{" "}
                  <span className="font-semibold tabular-nums">{formatGpa(enteredTerm)}</span>. راجع الكشف قبل التأكيد (قد يكون السبب مادة مُعادة أو مستبعدة).
                </span>
              </p>
            )}
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} placeholder="ملاحظة للطالب: ما الذي يعدّله، أو تشجيع…" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={sendBack} disabled={isPending || note.trim().length < 3} title="اكتب الملاحظة أولاً">
            <Undo2 /> إعادة للطالب
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? <Spinner /> : <CheckCircle2 />} {report.status === "reviewed" ? "حفظ وإعادة الحساب" : coursesChanged ? "تعديل ثم تأكيد" : "تأكيد الكشف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
