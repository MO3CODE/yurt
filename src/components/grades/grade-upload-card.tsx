"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileText, FileUp, MessageSquareText, Send, Trophy, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { CourseRowsEditor } from "@/components/grades/course-rows-editor";
import { emptyCourse, parseCourses, previewCourses, type CourseDraft } from "@/lib/course-drafts";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { submitGradeReport } from "@/app/app/grades/actions";
import { compressImage, uploadErrorMessage } from "@/lib/image-compress";
import { formatShortDateISO } from "@/lib/date";
import { GRADES_BUCKET, KIND_LABELS, MAX_GRADE_FILES, formatGpa, parseGpa, type ReportKind, type WindowState } from "@/lib/grades";
import {
  AWARD_STATUS_LABELS,
  FLAG_LABELS,
  RISK_META,
  STATUS_META,
  TIER_META,
  type AwardStatus,
  type AwardTier,
  type GradeScale,
  type ScholarshipSettings,
  type StandingFlag,
  type StandingStatus,
} from "@/lib/scholarship";

const MAX_PDF_MB = 10;

export type GradeReportView = {
  status: "pending" | "returned" | "reviewed";
  termGpa: number | null;
  cumulativeGpa: number | null;
  verifiedTermGpa: number | null;
  verifiedCumulativeGpa: number | null;
  note: string | null;
  adminNote: string | null;
  submittedAt: string;
  paths: string[];
  files: { url: string; isPdf: boolean }[];
  courses: CourseDraft[];
};

export type StandingView = { status: StandingStatus; flags: StandingFlag[] } | null;
export type AwardView = { tier: AwardTier; amount: number; currency: string; status: AwardStatus } | null;

export function GradeUploadCard({
  termId,
  kind,
  userId,
  window: win,
  state,
  report,
  scale,
  settings,
  suggestions,
  standing,
  award,
  prefill = [],
}: {
  termId: string;
  kind: ReportKind;
  userId: string;
  window: { from: string | null; to: string | null };
  state: WindowState;
  report: GradeReportView | null;
  scale: GradeScale;
  settings: ScholarshipSettings;
  suggestions: string[];
  standing: StandingView;
  award: AwardView;
  /** مواد الترم المسجّلة: تُملأ بها صفوف الكشف الجديد */
  prefill?: CourseDraft[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<CourseDraft[]>(
    report?.courses.length ? report.courses : prefill.length ? prefill : [emptyCourse(), emptyCourse(), emptyCourse()]
  );
  const [termGpa, setTermGpa] = useState(report?.termGpa != null ? String(report.termGpa) : "");
  const [cumGpa, setCumGpa] = useState(report?.cumulativeGpa != null ? String(report.cumulativeGpa) : "");
  const [note, setNote] = useState(report?.note ?? "");
  const [stage, setStage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement | null>(null);

  const isFinal = kind === "final";
  const reviewed = report?.status === "reviewed";
  const returned = report?.status === "returned";
  const showForm = state !== "upcoming" && state !== "unscheduled" && !reviewed && (!report || editing || returned);
  const late = state === "closed" && !report;
  const keepFiles = !!report && files.length === 0;

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
    if (files.length === 0 && !report) return toast.error("ارفع ملف الدرجات (PDF أو صورة)");
    const parsed = parseCourses(rows, kind);
    if ("error" in parsed) return toast.error(parsed.error);
    const t = parseGpa(termGpa);
    const c = parseGpa(cumGpa);
    if (isFinal && (t === null || c === null)) return toast.error("اكتب المعدل الفصلي والتراكمي كما في كشفك");
    if ([t, c].some((n) => n !== null && (Number.isNaN(n) || n < 0 || n > 4))) return toast.error("المعدل رقم بين ٠ و٤، مثل 3.25");

    startTransition(async () => {
      try {
        let paths = report?.paths ?? [];
        if (files.length) {
          const supabase = createClient();
          const stamp = Date.now();
          paths = [];
          for (const [i, file] of files.entries()) {
            setStage(`رفع الملف ${i + 1} من ${files.length}…`);
            const isPdf = file.type === "application/pdf";
            const body = isPdf ? file : await compressImage(file, 2000, 0.85);
            const path = `${userId}/${termId}/${kind}-${stamp}-${i + 1}.${isPdf ? "pdf" : "jpg"}`;
            const { error } = await supabase.storage.from(GRADES_BUCKET).upload(path, body, { contentType: isPdf ? "application/pdf" : "image/jpeg" });
            if (error) throw new Error(uploadErrorMessage(error.message));
            paths.push(path);
          }
        }
        setStage("إرسال…");
        const r = await submitGradeReport({
          termId,
          kind,
          paths,
          termGpa: isFinal ? t : null,
          cumulativeGpa: isFinal ? c : null,
          note: note.trim() || null,
          courses: parsed.courses,
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

  const stateBadge = reviewed ? (
    <Badge className="bg-success/15 text-success">رُوجع ✓</Badge>
  ) : returned ? (
    <Badge className="bg-destructive/12 text-destructive">
      <Undo2 /> أُعيد إليك للتعديل
    </Badge>
  ) : report ? (
    <Badge variant="outline">بانتظار المراجعة</Badge>
  ) : state === "unscheduled" ? (
    <Badge variant="outline">لم تُحدَّد فترة الرفع بعد</Badge>
  ) : state === "upcoming" ? (
    <Badge variant="outline">تُفتح {formatShortDateISO(win.from as string)}</Badge>
  ) : late ? (
    <Badge className="bg-destructive/12 text-destructive">انتهت الفترة — ارفعه الآن</Badge>
  ) : (
    <Badge className="bg-warning/20 text-warning-foreground dark:text-warning">مطلوب حتى {formatShortDateISO(win.to as string)}</Badge>
  );

  const adminNote = report?.adminNote && (
    <p className={cn("flex gap-2 rounded-lg p-2.5 text-sm", returned ? "bg-destructive/[0.07]" : "bg-muted/60")}>
      <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="whitespace-pre-line">{report.adminNote}</span>
    </p>
  );

  // ملخص المواد بعد الإرسال (بنفس تصنيف النظام)
  const summary = report ? previewCourses(report.courses, kind, scale, settings) : null;
  const needSupport = summary?.classified.filter((c) => c.risk && c.risk !== "ok" && c.risk !== "excluded") ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">كشف {KIND_LABELS[kind]}</span>
        {stateBadge}
      </div>
      {win.from && win.to && (
        <p className="text-xs text-muted-foreground">
          فترة الرفع: {formatShortDateISO(win.from)} – {formatShortDateISO(win.to)}
        </p>
      )}

      {report && !showForm && (
        <div className="flex flex-col gap-2.5">
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

          {summary && report.courses.length > 0 && (
            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {summary.classified.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                  <span className="min-w-0 truncate">{c.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span dir="ltr" className="tabular-nums">
                      {isFinal ? c.letter : c.percent !== null && c.percent !== undefined ? `${c.percent}%` : "—"}
                    </span>
                    {c.risk && c.risk !== "ok" && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", RISK_META[c.risk].className)}>{RISK_META[c.risk].label}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {reviewed && standing && (
            <div className="flex flex-col gap-1.5 rounded-lg border p-2.5 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                حالتك مع المنحة:
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_META[standing.status].className)}>{STATUS_META[standing.status].label}</span>
              </span>
              {standing.flags.length > 0 && (
                <span className="text-xs text-muted-foreground">{standing.flags.filter((f) => f !== "gpa_mismatch").map((f) => FLAG_LABELS[f]).join(" · ")}</span>
              )}
              {needSupport.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ستتواصل معك الإدارة لترتيب دعم في: {needSupport.map((c) => c.name).join("، ")}
                </span>
              )}
            </div>
          )}
          {reviewed && !isFinal && needSupport.length > 0 && (
            <p className="rounded-lg border p-2.5 text-xs text-muted-foreground">
              تنبيه مبكر — ستتواصل معك الإدارة لترتيب دعم في: {needSupport.map((c) => c.name).join("، ")}
            </p>
          )}

          {award && award.status !== "cancelled" && (
            <p className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/[0.08] p-2.5 text-sm">
              <Trophy className="mt-0.5 size-4 shrink-0 text-gold-foreground dark:text-gold" />
              <span>
                مبارك! أنت من المتميزين هذا الترم — {TIER_META[award.tier].medal} الفئة {TIER_META[award.tier].label} ·{" "}
                <span className="font-semibold tabular-nums" dir="ltr">
                  {award.amount} {award.currency}
                </span>{" "}
                ({AWARD_STATUS_LABELS[award.status]})
              </span>
            </p>
          )}

          {adminNote}
          {!reviewed && (
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setEditing(true)}>
              تعديل المواد أو الملف أو المعدل
            </Button>
          )}
        </div>
      )}

      {showForm && (
        <div className="flex flex-col gap-3">
          {returned && adminNote}

          <CourseRowsEditor rows={rows} onChange={setRows} kind={kind} scale={scale} settings={settings} suggestions={suggestions} allowHelp disabled={isPending} />

          <div className="flex flex-wrap gap-2">
            {keepFiles &&
              report.files.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-1 text-xs">
                  <FileText className="size-3.5" /> الملف الحالي {i + 1}
                </span>
              ))}
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
              <FileUp className="size-5" />{" "}
              {files.length ? "أضف ملفاً آخر" : report ? "استبدل الملف (اختياري)" : "اختر ملف الدرجات (PDF أو صورة من نظام الجامعة)"}
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
              <p className="col-span-2 text-[11px] text-muted-foreground">انقلهما كما في كشف الجامعة؛ المعدل المحسوب من موادك يُقارَن بهما.</p>
            </div>
          )}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="ملاحظة للإدارة (اختياري)" />
          <div className="flex gap-2">
            <Button onClick={submit} disabled={isPending || (files.length === 0 && !report)} className="w-fit">
              {isPending ? <Spinner /> : <Send />} {stage ?? (report ? "إرسال التعديل" : "إرسال")}
            </Button>
            {editing && !returned && (
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
