"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Download, FileSpreadsheet, MessageCircle, Upload, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importStudentsChunk, type ImportedStudent } from "@/app/admin/students/import-actions";
import { formatGpa } from "@/lib/academic";
import {
  FIELD_LABELS,
  displayLogin,
  matchApartment,
  parseDelimited,
  parseStudentMatrix,
  TEMPLATE_HEADERS,
  type ApartmentRef,
} from "@/lib/student-import";
import { buildCredentialsMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { buildXlsx, readXlsx } from "@/lib/xlsx-lite";
import { unwrap } from "@/lib/unwrap";
import { cn } from "@/lib/utils";

const CHUNK = 8;
const MAX_ROWS = 400;

type Step = "input" | "importing" | "done";

function downloadXlsx(name: string, rows: string[][], widths?: number[]) {
  const bytes = buildXlsx(rows, { sheetName: "الطلاب", widths });
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV من Excel القديم قد يكون بترميز windows-1256 فنجرّب UTF-8 أولاً */
async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1256").decode(buffer);
  }
}

export function ImportStudentsDialog({ apartments, existingPhones }: { apartments: ApartmentRef[]; existingPhones: string[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [fileMatrix, setFileMatrix] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportedStudent[]>([]);
  const [academicSkipped, setAcademicSkipped] = useState(false);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const matrix = useMemo(() => fileMatrix ?? parseDelimited(text), [fileMatrix, text]);
  const existing = useMemo(() => new Set(existingPhones), [existingPhones]);

  const rows = useMemo(
    () =>
      parseStudentMatrix(matrix).map((r) => {
        const apt = matchApartment(r.apartmentText, apartments);
        const warnings = [...r.warnings];
        if (apt.kind === "none") warnings.push(`الشقة «${r.apartmentText}» غير موجودة — يُستورد بلا شقة`);
        if (apt.kind === "ambiguous") warnings.push(`الشقة «${r.apartmentText}» تنطبق على أكثر من شقة — يُستورد بلا شقة`);
        const apartmentId = apt.kind === "match" ? apt.id : null;
        return {
          ...r,
          warnings,
          apartmentId,
          apartmentName: apartmentId ? apartments.find((a) => a.id === apartmentId)?.name : undefined,
          isUpdate: existing.has(r.phone),
        };
      }),
    [matrix, apartments, existing]
  );
  const ready = rows.filter((r) => r.errors.length === 0);
  const blocked = rows.length - ready.length;
  const newCount = ready.filter((r) => !r.isUpdate).length;
  const updateCount = ready.length - newCount;
  const tooMany = ready.length > MAX_ROWS;

  function reset() {
    setStep("input");
    setText("");
    setFileMatrix(null);
    setFileName("");
    setProgress(0);
    setResults([]);
    setAcademicSkipped(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next && step === "importing") return; // لا نغلق أثناء الإنشاء
    setOpen(next);
    if (!next) reset();
  }

  async function handleFile(file: File) {
    setReading(true);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".xls")) throw new Error("صيغة .xls القديمة غير مدعومة — احفظ الملف من Excel بصيغة .xlsx أو CSV");
      const data = name.endsWith(".xlsx") ? await readXlsx(file) : parseDelimited(await readTextFile(file));
      setFileMatrix(data);
      setFileName(file.name);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّرت قراءة الملف");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function run() {
    setStep("importing");
    setProgress(0);
    const all: ImportedStudent[] = [];
    let skipped = false;
    try {
      for (let i = 0; i < ready.length; i += CHUNK) {
        const chunk = ready.slice(i, i + CHUNK);
        const res = await unwrap(
          importStudentsChunk({
            rows: chunk.map((r) => ({
              line: r.line,
              name: r.name,
              phone: r.phone,
              email: r.email,
              major: r.major,
              university: r.university,
              academicYear: r.year,
              apartmentId: r.apartmentId,
              gpa: r.gpa?.gpa ?? null,
              gpaScale: r.gpa?.scale ?? 4,
              strong: r.strong,
              struggling: r.struggling,
            })),
          })
        );
        all.push(...res.results);
        skipped ||= res.academicSkipped;
        setResults([...all]);
        setProgress(Math.min(ready.length, i + CHUNK));
      }
    } catch (e) {
      // ما تمّ حتى الآن محفوظ؛ نعرضه كي لا تضيع كلمات المرور
      toast.error(e instanceof Error ? `توقف الاستيراد: ${e.message}` : "توقف الاستيراد");
    }
    setAcademicSkipped(skipped);
    setStep("done");
  }

  const created = results.filter((r) => r.status === "created" && r.credentials);
  const updated = results.filter((r) => r.status === "updated");
  const failed = results.filter((r) => r.status === "failed");
  const loginUrl = typeof window !== "undefined" ? window.location.origin + "/login" : "";

  const messageFor = (r: ImportedStudent) =>
    buildCredentialsMessage({ fullName: r.name, email: r.credentials!.login, password: r.credentials!.password, loginUrl });

  function credentialsRows(): string[][] {
    return [["الاسم", "اسم الدخول", "كلمة المرور", "الهاتف"], ...created.map((r) => [r.name, displayLogin(r.credentials!.login), r.credentials!.password, r.credentials!.phone])];
  }

  function copyAll() {
    const textOut = created.map((r) => `${r.name}\t${displayLogin(r.credentials!.login)}\t${r.credentials!.password}`).join("\n");
    navigator.clipboard.writeText(textOut).then(
      () => toast.success("نُسخت بيانات الدخول"),
      () => toast.error("تعذّر النسخ — نزّل الملف بدلاً من ذلك")
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <FileSpreadsheet /> استيراد من Excel
          </Button>
        }
      />
      <DialogContent className="sm:max-w-3xl">
        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle>استيراد الطلاب من Excel</DialogTitle>
              <DialogDescription>
                الأعمدة بالترتيب: {["name", "major", "university", "apartment", "year", "phone", "gpa", "struggling"].map((f) => FIELD_LABELS[f as keyof typeof FIELD_LABELS]).join(" · ")}.
                رقم الهاتف إلزامي لأنه اسم دخول الطالب. من سبق تسجيل رقمه يُحدَّث بدل أن يتكرر.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.csv,.txt,text/csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={reading}>
                  {reading ? <Spinner /> : <Upload />} اختيار ملف Excel أو CSV
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => downloadXlsx("students-template.xlsx", [TEMPLATE_HEADERS], [22, 20, 26, 14, 16, 18, 14, 30])}>
                  <Download /> تنزيل القالب
                </Button>
                {fileName && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileSpreadsheet className="size-3.5" /> {fileName}
                    <button type="button" onClick={() => (setFileMatrix(null), setFileName(""))} className="rounded p-0.5 hover:bg-muted" aria-label="إزالة الملف">
                      <X className="size-3" />
                    </button>
                  </span>
                )}
              </div>

              {!fileMatrix && (
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  dir="auto"
                  className="font-mono text-xs leading-relaxed"
                  placeholder="أو انسخ الجدول من Excel والصقه هنا"
                  aria-label="الصق الجدول هنا"
                />
              )}

              {rows.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{ready.length} جاهز</span>
                    {newCount > 0 && <span>{newCount} حساب جديد</span>}
                    {updateCount > 0 && <span>{updateCount} تحديث لطالب موجود</span>}
                    {blocked > 0 && <span className="text-destructive">{blocked} به خطأ (يُتجاهل)</span>}
                  </p>
                  {tooMany && <p className="text-xs text-destructive">الحد الأقصى {MAX_ROWS} طالب في المرة الواحدة — قسّم الملف.</p>}
                  <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-xl border">
                    {rows.map((r) => (
                      <li key={r.line} className={cn("flex items-start gap-2.5 p-2.5 text-sm", r.errors.length > 0 && "bg-destructive/[0.04]")}>
                        <span
                          className={cn(
                            "mt-0.5 shrink-0",
                            r.errors.length > 0 ? "text-destructive" : r.warnings.length > 0 ? "text-warning-foreground dark:text-warning" : "text-success"
                          )}
                        >
                          {r.errors.length > 0 ? <X className="size-4" /> : r.warnings.length > 0 ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {r.name || <span className="text-muted-foreground">بلا اسم</span>}
                            {r.errors.length === 0 && (
                              <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem]", r.isUpdate ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                                {r.isUpdate ? "تحديث" : "جديد"}
                              </span>
                            )}
                            <span className="text-[0.65rem] font-normal text-muted-foreground">سطر {r.line}</span>
                          </span>
                          {r.errors.map((e) => (
                            <span key={e} className="text-xs text-destructive">
                              {e}
                            </span>
                          ))}
                          {r.warnings.map((w) => (
                            <span key={w} className="text-xs text-warning-foreground dark:text-warning">
                              {w}
                            </span>
                          ))}
                          <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            {r.phone && <span dir="ltr">{r.phone}</span>}
                            {r.apartmentName && <span>{r.apartmentName}</span>}
                            {r.university && <span>{r.university}</span>}
                            {r.major && <span>{r.major}</span>}
                            {r.year && <span>{r.year}</span>}
                            {r.gpa && <span dir="ltr">{formatGpa(r.gpa.gpa, r.gpa.scale)}</span>}
                            {r.struggling.length > 0 && <span>متعثر في {r.struggling.join("، ")}</span>}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={run} disabled={ready.length === 0 || tooMany}>
                <UserPlus /> استيراد {ready.length > 0 ? `${ready.length} طالب` : ""}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "importing" && (
          <>
            <DialogHeader>
              <DialogTitle>جارٍ الاستيراد…</DialogTitle>
              <DialogDescription>لا تغلق النافذة حتى ينتهي إنشاء الحسابات.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-4">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(progress / Math.max(1, ready.length)) * 100}%` }} />
              </div>
              <span className="text-center text-xs text-muted-foreground tabular-nums">
                {progress} / {ready.length}
              </span>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>اكتمل الاستيراد</DialogTitle>
              <DialogDescription>
                {created.length} حساب جديد · {updated.length} تحديث
                {failed.length > 0 && <span className="text-destructive"> · {failed.length} فشل</span>}
              </DialogDescription>
            </DialogHeader>

            <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto">
              {academicSkipped && (
                <p className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                  لم تُحفظ المعدلات والمواد المتعثرة لأن حسابك لا يملك صلاحية «المتابعة الأكاديمية».
                </p>
              )}

              {created.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-warning-foreground dark:text-warning">
                    كلمات المرور تظهر هنا مرة واحدة فقط — أرسلها عبر واتساب أو نزّلها الآن. يمكنك لاحقاً توليد كلمة جديدة لأي طالب من صفحته.
                  </p>
                  <ul className="flex flex-col divide-y rounded-xl border">
                    {created.map((r) => (
                      <li key={r.line} className="flex items-center justify-between gap-3 p-2.5 text-sm">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{r.name}</span>
                          <span className="flex gap-3 text-xs text-muted-foreground" dir="ltr">
                            <span>{displayLogin(r.credentials!.login)}</span>
                            <span className="font-mono">{r.credentials!.password}</span>
                          </span>
                          {r.error && <span className="text-xs text-destructive">{r.error}</span>}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<a href={buildWhatsAppLink(r.credentials!.phone, messageFor(r))} target="_blank" rel="noopener noreferrer" />}
                        >
                          <MessageCircle /> واتساب
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {failed.length > 0 && (
                <ul className="flex flex-col divide-y rounded-xl border border-destructive/30">
                  {failed.map((r) => (
                    <li key={r.line} className="flex flex-col gap-0.5 p-2.5 text-sm">
                      <span className="font-medium">
                        {r.name} <span className="text-xs font-normal text-muted-foreground">سطر {r.line}</span>
                      </span>
                      <span className="text-xs text-destructive">{r.error}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DialogFooter>
              {created.length > 0 && (
                <>
                  <Button variant="outline" onClick={copyAll}>
                    <Copy /> نسخ الكل
                  </Button>
                  <Button variant="outline" onClick={() => downloadXlsx("students-credentials.xlsx", credentialsRows(), [26, 24, 18, 18])}>
                    <Download /> تنزيل بيانات الدخول
                  </Button>
                </>
              )}
              <Button onClick={() => handleOpenChange(false)}>إغلاق</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
