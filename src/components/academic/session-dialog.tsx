"use client";

import { useState, useTransition } from "react";
import { NotebookPen, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { saveAcademicRecord } from "@/app/admin/academic/actions";
import { GPA_SCALES, subjectKey, toAsciiDigits } from "@/lib/academic";
import type { SubjectStanding } from "@/lib/supabase/types";
import { unwrap } from "@/lib/unwrap";
import { toast } from "sonner";
import { Segmented } from "@/components/segmented";

type Draft = { name: string; standing: SubjectStanding; grade: string };

const STANDING_LABELS: Record<SubjectStanding, string> = { strong: "قوي", struggling: "متعثر" };

export function SessionDialog({
  studentId,
  studentName,
  mode,
  today,
  gpa,
  gpaScale,
  nextSession,
  subjects,
  catalog,
}: {
  studentId: string;
  studentName: string;
  mode: "session" | "edit";
  today: string;
  gpa: number | null;
  gpaScale: number;
  nextSession: string | null;
  subjects: { name: string; standing: SubjectStanding; grade: number | null }[];
  catalog: string[];
}) {
  const initialDrafts = (): Draft[] => subjects.map((s) => ({ name: s.name, standing: s.standing, grade: s.grade === null ? "" : String(s.grade) }));

  const [open, setOpen] = useState(false);
  const [recordSession, setRecordSession] = useState(mode === "session");
  const [sessionDate, setSessionDate] = useState(today);
  const [gpaText, setGpaText] = useState(gpa === null ? "" : String(gpa));
  const [scale, setScale] = useState<number>(gpaScale);
  const [summary, setSummary] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [nextDate, setNextDate] = useState(nextSession ?? "");
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [newName, setNewName] = useState("");
  const [newStanding, setNewStanding] = useState<SubjectStanding>("struggling");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // نبدأ كل مرة من آخر بيانات محفوظة
      setRecordSession(mode === "session");
      setSessionDate(today);
      setGpaText(gpa === null ? "" : String(gpa));
      setScale(gpaScale);
      setSummary("");
      setActionItems("");
      setNextDate(nextSession ?? "");
      setDrafts(initialDrafts());
      setNewName("");
      setError(null);
    }
  }

  function addSubject() {
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) return;
    const key = subjectKey(name);
    setDrafts((prev) => [...prev.filter((d) => subjectKey(d.name) !== key), { name, standing: newStanding, grade: "" }]);
    setNewName("");
  }

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const gpaValue = gpaText.trim() === "" ? null : Number(toAsciiDigits(gpaText).replace(",", "."));
    if (gpaValue !== null && (Number.isNaN(gpaValue) || gpaValue < 0)) return setError("المعدل غير صحيح");
    if (gpaValue !== null && gpaValue > scale) return setError(`المعدل أكبر من المقياس (${scale})`);

    const subjectsPayload: { name: string; standing: SubjectStanding; grade: number | null }[] = [];
    for (const d of drafts) {
      const raw = d.grade.trim();
      const grade = raw === "" ? null : Number(toAsciiDigits(raw).replace(",", "."));
      if (grade !== null && (Number.isNaN(grade) || grade < 0 || grade > 100)) return setError(`درجة «${d.name}» يجب أن تكون بين ٠ و١٠٠`);
      subjectsPayload.push({ name: d.name, standing: d.standing, grade });
    }

    startTransition(async () => {
      try {
        await unwrap(
          saveAcademicRecord({
            studentId,
            recordSession,
            sessionDate: recordSession ? sessionDate : undefined,
            gpa: gpaValue,
            gpaScale: scale,
            summary: recordSession ? summary : undefined,
            actionItems: recordSession ? actionItems : undefined,
            nextSessionDate: nextDate || null,
            subjects: subjectsPayload,
          })
        );
        toast.success(recordSession ? "سُجّلت الجلسة وحُدّث الملف" : "حُفظ الملف الأكاديمي");
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذّر الحفظ");
      }
    });
  }

  const suggestions = catalog.filter((n) => !drafts.some((d) => subjectKey(d.name) === subjectKey(n)));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          mode === "session" ? (
            <Button>
              <NotebookPen /> جلسة تقييم جديدة
            </Button>
          ) : (
            <Button variant="outline">
              <Pencil /> تعديل الملف
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "session" ? "جلسة تقييم" : "الملف الأكاديمي"} — {studentName}</DialogTitle>
          <DialogDescription>حدّث المعدل والمواد، ثم احفظ. يُسجَّل تاريخ الجلسة وملخصها في سجل الطالب.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto pe-1">
            <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <span className="flex flex-col leading-snug">
                <span className="font-medium">تسجيل كجلسة تقييم</span>
                <span className="text-xs text-muted-foreground">أوقفه لتصحيح البيانات فقط دون إضافة جلسة للسجل</span>
              </span>
              <Switch checked={recordSession} onCheckedChange={setRecordSession} />
            </label>

            {recordSession && (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="s-date">تاريخ الجلسة</FieldLabel>
                  <Input id="s-date" type="date" dir="ltr" className="text-start" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="s-summary">ملخص الجلسة</FieldLabel>
                  <Textarea id="s-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="أبرز ما دار في الجلسة، ظروف الطالب، ملاحظات…" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="s-actions">الخطوات المتفق عليها</FieldLabel>
                  <Textarea id="s-actions" rows={2} value={actionItems} onChange={(e) => setActionItems(e.target.value)} placeholder="كل خطوة في سطر" />
                </Field>
              </FieldGroup>
            )}

            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="s-gpa">المعدل</FieldLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input id="s-gpa" inputMode="decimal" dir="ltr" className="w-24 text-start" value={gpaText} onChange={(e) => setGpaText(e.target.value)} placeholder="3.20" />
                    <Segmented
                      label="مقياس المعدل"
                      value={scale}
                      onChange={setScale}
                      options={GPA_SCALES.map((s) => ({ value: s as number, label: `من ${s}` }))}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="s-next">موعد الجلسة القادمة</FieldLabel>
                  <Input id="s-next" type="date" dir="ltr" className="text-start" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
                  <FieldDescription>يعتمد عليه تذكير واتساب</FieldDescription>
                </Field>
              </div>
            </FieldGroup>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">المواد</span>
              {drafts.length === 0 && <p className="text-xs text-muted-foreground">لم تُضف مواد بعد — أضف المواد التي يتفوق فيها الطالب أو يتعثر.</p>}
              <ul className="flex flex-col gap-1.5">
                {drafts.map((d, i) => (
                  <li key={d.name} className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
                    <Segmented
                      label={`تصنيف ${d.name}`}
                      value={d.standing}
                      onChange={(v) => updateDraft(i, { standing: v })}
                      options={[
                        { value: "strong" as SubjectStanding, label: STANDING_LABELS.strong, className: "text-success" },
                        { value: "struggling" as SubjectStanding, label: STANDING_LABELS.struggling, className: "text-destructive" },
                      ]}
                    />
                    <Input
                      inputMode="decimal"
                      dir="ltr"
                      className="h-7 w-16 text-center text-xs"
                      placeholder="الدرجة"
                      aria-label={`درجة ${d.name}`}
                      value={d.grade}
                      onChange={(e) => updateDraft(i, { grade: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`حذف ${d.name}`}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-2">
                <Input
                  list="academic-subject-catalog"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubject();
                    }
                  }}
                  placeholder="اسم المادة…"
                  aria-label="اسم مادة جديدة"
                  className="h-8 min-w-32 flex-1"
                />
                <datalist id="academic-subject-catalog">
                  {suggestions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <Segmented
                  label="تصنيف المادة الجديدة"
                  value={newStanding}
                  onChange={setNewStanding}
                  options={[
                    { value: "strong" as SubjectStanding, label: STANDING_LABELS.strong, className: "text-success" },
                    { value: "struggling" as SubjectStanding, label: STANDING_LABELS.struggling, className: "text-destructive" },
                  ]}
                />
                <Button type="button" size="sm" variant="secondary" onClick={addSubject} disabled={!newName.trim()}>
                  <Plus /> إضافة
                </Button>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              {recordSession ? "حفظ الجلسة" : "حفظ الملف"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
