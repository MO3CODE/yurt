"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Download, FileSpreadsheet, FileUp, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { StudentPicker, downloadXlsx } from "@/components/grades/term-import-dialog";
import { importLanguageProgress, removeLanguageProgress, saveLanguageProgress } from "@/app/admin/academic/language-actions";
import { matchStudentByName } from "@/lib/academic";
import { LANGUAGE_HEADERS, parseLanguageRows, textToMatrix } from "@/lib/term-import";
import { LANGUAGE_LEVELS, LANGUAGE_STATUS_META, LANGUAGE_STATUS_ORDER, type LanguageStatus } from "@/lib/scholarship";
import { readXlsx } from "@/lib/xlsx-lite";
import { unwrap } from "@/lib/unwrap";
import { cn } from "@/lib/utils";

export type LanguageProgressView = {
  studentId: string;
  levelsPassed: string[];
  currentLevel: string | null;
  status: LanguageStatus;
  nextExamAt: string | null;
  notes: string | null;
};

const ALL_LEVELS = [...LANGUAGE_LEVELS, "كامل"];
const NONE = "__none";

export function LanguageProgressDialog({
  students,
  progress,
}: {
  students: { id: string; name: string }[];
  progress?: LanguageProgressView & { studentName: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(progress?.studentId ?? null);
  const [levels, setLevels] = useState<string[]>(progress?.levelsPassed ?? []);
  const [current, setCurrent] = useState<string | null>(progress?.currentLevel ?? null);
  const [status, setStatus] = useState<LanguageStatus>(progress?.status ?? "studying");
  const [exam, setExam] = useState(progress?.nextExamAt ?? "");
  const [notes, setNotes] = useState(progress?.notes ?? "");
  const [isPending, startTransition] = useTransition();

  const levelItems = [{ value: NONE, label: "—" }, ...LANGUAGE_LEVELS.map((l) => ({ value: l, label: l }))];
  const statusItems = LANGUAGE_STATUS_ORDER.map((s) => ({ value: s, label: LANGUAGE_STATUS_META[s].label }));

  function run(fn: () => Promise<unknown>, ok: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  function save() {
    if (!studentId) return toast.error("اختر الطالب");
    run(
      () => unwrap(saveLanguageProgress({ studentId, levelsPassed: levels, currentLevel: current, status, nextExamAt: exam || null, notes: notes.trim() || null })),
      "حُفظت متابعة اللغة"
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          progress ? (
            <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${progress.studentName}`}>
              <Pencil />
            </Button>
          ) : (
            <Button variant="outline">
              <Plus /> طالب لغة
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{progress ? progress.studentName : "إضافة طالب لغة"}</DialogTitle>
          <DialogDescription>المستويات المجتازة والمستوى الحالي وموعد الامتحان النهائي</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {!progress && (
            <div className="flex flex-col gap-1.5">
              <Label>الطالب</Label>
              <StudentPicker students={students} value={studentId} onChange={setStudentId} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>المستويات المجتازة</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_LEVELS.map((l) => {
                const on = levels.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setLevels((prev) => (on ? prev.filter((x) => x !== l) : [...prev, l].sort((a, b) => ALL_LEVELS.indexOf(a) - ALL_LEVELS.indexOf(b))))}
                    className={cn("rounded-full border px-2.5 py-1 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                    dir="ltr"
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>المستوى الحالي</Label>
              <Select value={current ?? NONE} onValueChange={(v) => setCurrent(!v || v === NONE ? null : (v as string))} items={levelItems}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {levelItems.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lp-exam">موعد الامتحان القادم</Label>
              <Input id="lp-exam" type="date" value={exam} onChange={(e) => setExam(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as LanguageStatus)} items={statusItems}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} placeholder="ملاحظات" />
        </div>
        <DialogFooter className="gap-2">
          {progress && (
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => run(() => unwrap(removeLanguageProgress(progress.studentId)), "أُزيل من متابعة اللغة")}
            >
              <Trash2 /> إزالة
            </Button>
          )}
          <Button onClick={save} disabled={isPending}>
            {isPending ? <Spinner /> : <Save />} حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** استيراد جدول طلاب اللغة من التقرير */
export function LanguageImportDialog({ students }: { students: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const rows = useMemo(
    () =>
      parseLanguageRows(matrix.length ? matrix : textToMatrix(text)).map((r) => {
        const m = matchStudentByName(r.name, students);
        return { ...r, matchKind: m.kind, studentId: r.line in overrides ? overrides[r.line] : m.kind === "match" ? m.id : null };
      }),
    [matrix, text, students, overrides]
  );
  const ready = rows.filter((r) => !r.problem && r.studentId);
  const nameOf = new Map(students.map((s) => [s.id, s.name]));

  async function pickFile(file: File | undefined) {
    if (!file) return;
    try {
      setMatrix(await readXlsx(file));
      setFileName(file.name);
      setOverrides({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّرت قراءة الملف");
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function submit() {
    startTransition(async () => {
      try {
        const res = await unwrap(
          importLanguageProgress({
            rows: ready.map((r) => ({
              studentId: r.studentId as string,
              levelsPassed: r.levelsPassed,
              currentLevel: r.currentLevel,
              status: r.status,
              nextExamAt: r.nextExamAt,
              notes: r.notes,
            })),
          })
        );
        toast.success(`استُوردت متابعة ${res.count} طالب لغة`);
        setOpen(false);
        setMatrix([]);
        setText("");
        setFileName(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الاستيراد");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <FileSpreadsheet /> استيراد من تقرير
          </Button>
        }
      />
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>استيراد طلاب اللغة</DialogTitle>
          <DialogDescription>الأعمدة: {LANGUAGE_HEADERS.join(" | ")}. الحالة تُفهم من نصها أو من الملاحظة (منتظر النتيجة، استعداد للاختبار، فرصة أخيرة، متخرج).</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <FileUp /> {fileName ?? "اختر ملف Excel"}
            </Button>
            <input ref={fileInput} type="file" accept=".xlsx" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            <Button variant="ghost" size="sm" onClick={() => downloadXlsx("قالب طلاب اللغة.xlsx", [LANGUAGE_HEADERS], "اللغة")}>
              <Download /> القالب
            </Button>
          </div>
          {!fileName && <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} dir="auto" placeholder="أو الصق الجدول من Excel" />}

          {rows.length > 0 && (
            <ul className="flex flex-col divide-y rounded-xl border text-sm">
              {rows.map((r) => {
                const bad = !!r.problem || !r.studentId;
                return (
                  <li key={r.line} className={cn("grid gap-2 p-2.5 sm:grid-cols-[1fr_1fr_1.4fr]", bad && "bg-destructive/[0.04]")}>
                    <span className="flex items-center gap-1.5 font-medium">
                      {bad ? <AlertTriangle className="size-3.5 shrink-0 text-destructive" /> : <Check className="size-3.5 shrink-0 text-success" />}
                      {r.name}
                    </span>
                    <span>
                      {r.matchKind === "match" && !(r.line in overrides) ? (
                        <button type="button" className="text-start text-xs hover:underline" onClick={() => setOverrides((o) => ({ ...o, [r.line]: r.studentId }))}>
                          {nameOf.get(r.studentId as string)}
                        </button>
                      ) : (
                        <StudentPicker students={students} value={r.studentId} onChange={(id) => setOverrides((o) => ({ ...o, [r.line]: id }))} />
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span dir="ltr">{r.levelsPassed.join(" · ") || "—"}</span>
                      {r.currentLevel && <span className="text-muted-foreground">← {r.currentLevel}</span>}
                      <span className={cn("rounded-full px-2 py-0.5", LANGUAGE_STATUS_META[r.status].className)}>{LANGUAGE_STATUS_META[r.status].label}</span>
                      {r.problem && <span className="text-destructive">{r.problem}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={isPending || ready.length === 0}>
            {isPending ? <Spinner /> : <Check />} استيراد {ready.length ? `${ready.length} طالب` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
