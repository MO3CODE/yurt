"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileText, FileUp, MessageSquareText, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { submitGradeReport } from "@/app/app/grades/actions";
import { compressImage, uploadErrorMessage } from "@/lib/image-compress";
import { formatShortDateISO } from "@/lib/date";
import { GRADES_BUCKET, KIND_LABELS, MAX_GRADE_FILES, formatGpa, parseGpa, type ReportKind, type WindowState } from "@/lib/grades";

const MAX_PDF_MB = 10;

export type GradeReportView = {
  status: "pending" | "reviewed";
  termGpa: number | null;
  cumulativeGpa: number | null;
  verifiedTermGpa: number | null;
  verifiedCumulativeGpa: number | null;
  note: string | null;
  adminNote: string | null;
  submittedAt: string;
  files: { url: string; isPdf: boolean }[];
};

export function GradeUploadCard({
  termId,
  kind,
  userId,
  window: win,
  state,
  report,
}: {
  termId: string;
  kind: ReportKind;
  userId: string;
  window: { from: string; to: string };
  state: WindowState;
  report: GradeReportView | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [termGpa, setTermGpa] = useState(report?.termGpa != null ? String(report.termGpa) : "");
  const [cumGpa, setCumGpa] = useState(report?.cumulativeGpa != null ? String(report.cumulativeGpa) : "");
  const [note, setNote] = useState(report?.note ?? "");
  const [stage, setStage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement | null>(null);

  const isFinal = kind === "final";
  const reviewed = report?.status === "reviewed";
  const showForm = state !== "upcoming" && !reviewed && (!report || editing);
  const late = state === "closed" && !report;

  function pick(list: FileList | null) {
    if (!list) return;
    const ok = [...list].filter((f) => {
      if (f.type === "application/pdf") {
        if (f.size > MAX_PDF_MB * 1024 * 1024) {
          toast.error(`ملف PDF أكبر من ${MAX_PDF_MB} ميغابايت`);
          return false;
        }
        return true;
      }
      return f.type.startsWith("image/");
    });
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_GRADE_FILES));
    if (input.current) input.current.value = "";
  }

  function submit() {
    if (files.length === 0) return toast.error("ارفع ملف الدرجات (PDF أو صورة)");
    const t = parseGpa(termGpa);
    const c = parseGpa(cumGpa);
    if (isFinal && (t === null || c === null)) return toast.error("اكتب المعدل الفصلي والتراكمي كما في كشفك");
    if ([t, c].some((n) => n !== null && (Number.isNaN(n) || n < 0 || n > 4))) return toast.error("المعدل رقم بين ٠ و٤، مثل 3.25");

    startTransition(async () => {
      try {
        const supabase = createClient();
        const stamp = Date.now();
        const paths: string[] = [];
        for (const [i, file] of files.entries()) {
          setStage(`رفع الملف ${i + 1} من ${files.length}…`);
          const isPdf = file.type === "application/pdf";
          const body = isPdf ? file : await compressImage(file, 2000, 0.85);
          const path = `${userId}/${termId}/${kind}-${stamp}-${i + 1}.${isPdf ? "pdf" : "jpg"}`;
          const { error } = await supabase.storage.from(GRADES_BUCKET).upload(path, body, { contentType: isPdf ? "application/pdf" : "image/jpeg" });
          if (error) throw new Error(uploadErrorMessage(error.message));
          paths.push(path);
        }
        setStage("إرسال…");
        const r = await submitGradeReport({
          termId,
          kind,
          paths,
          termGpa: isFinal ? t : null,
          cumulativeGpa: isFinal ? c : null,
          note: note.trim() || null,
        });
        if (!r.ok) throw new Error(r.error);
        toast.success("أُرسل كشفك، ستراجعه الإدارة");
        setFiles([]);
        setEditing(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الإرسال");
      } finally {
        setStage(null);
      }
    });
  }

  const stateBadge =
    reviewed ? (
      <Badge className="bg-success/15 text-success">رُوجع ✓</Badge>
    ) : report ? (
      <Badge variant="outline">بانتظار المراجعة</Badge>
    ) : state === "upcoming" ? (
      <Badge variant="outline">تُفتح {formatShortDateISO(win.from)}</Badge>
    ) : late ? (
      <Badge className="bg-destructive/12 text-destructive">انتهت الفترة — ارفعه الآن</Badge>
    ) : (
      <Badge className="bg-warning/20 text-warning-foreground dark:text-warning">مطلوب حتى {formatShortDateISO(win.to)}</Badge>
    );

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">كشف {KIND_LABELS[kind]}</span>
        {stateBadge}
      </div>
      <p className="text-xs text-muted-foreground">
        فترة الرفع: {formatShortDateISO(win.from)} – {formatShortDateISO(win.to)}
      </p>

      {report && !showForm && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {report.files.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-muted/50">
                <FileText className="size-4 text-muted-foreground" /> {f.isPdf ? "PDF" : "صورة"} {i + 1}
              </a>
            ))}
          </div>
          {isFinal && (
            <p className="text-sm">
              المعدل الفصلي: <span className="font-semibold tabular-nums">{formatGpa(report.verifiedTermGpa ?? report.termGpa)}</span> · التراكمي:{" "}
              <span className="font-semibold tabular-nums">{formatGpa(report.verifiedCumulativeGpa ?? report.cumulativeGpa)}</span>
              {reviewed && <CheckCircle2 className="ms-1 inline size-4 text-success" aria-label="مؤكَّد من الإدارة" />}
            </p>
          )}
          {report.adminNote && (
            <p className="flex gap-2 rounded-lg bg-muted/60 p-2.5 text-sm">
              <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="whitespace-pre-line">{report.adminNote}</span>
            </p>
          )}
          {!reviewed && (
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setEditing(true)}>
              تبديل الملف أو تعديل المعدل
            </Button>
          )}
        </div>
      )}

      {showForm && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-1 text-xs">
                <FileText className="size-3.5" />
                <span className="max-w-40 truncate" dir="ltr">
                  {f.name}
                </span>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="إزالة الملف">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          {files.length < MAX_GRADE_FILES && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50"
            >
              <FileUp className="size-5" /> {files.length ? "أضف ملفاً آخر" : "اختر ملف الدرجات (PDF أو صورة من نظام الجامعة)"}
            </button>
          )}
          <input ref={input} type="file" accept="application/pdf,image/*" multiple hidden onChange={(e) => pick(e.target.files)} />

          {isFinal && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`tg-${termId}`}>المعدل الفصلي (ANO)</Label>
                <Input id={`tg-${termId}`} value={termGpa} onChange={(e) => setTermGpa(e.target.value)} inputMode="decimal" placeholder="3.25" dir="ltr" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`cg-${termId}`}>المعدل التراكمي (GANO)</Label>
                <Input id={`cg-${termId}`} value={cumGpa} onChange={(e) => setCumGpa(e.target.value)} inputMode="decimal" placeholder="3.10" dir="ltr" />
              </div>
            </div>
          )}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="ملاحظة للإدارة (اختياري)" />
          <div className="flex gap-2">
            <Button onClick={submit} disabled={isPending || files.length === 0} className={cn("w-fit")}>
              {isPending ? <Spinner /> : <Send />} {stage ?? (report ? "إرسال التعديل" : "إرسال")}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={isPending}>
                إلغاء
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
