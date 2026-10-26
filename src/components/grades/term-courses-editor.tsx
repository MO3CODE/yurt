"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, Check, ImageUp, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { addTermCourses, readTermCoursesFromImages, removeTermCourse } from "@/app/term-courses-actions";
import { compressImage } from "@/lib/image-compress";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/unwrap";

export type TermCourse = { id: string; course_name: string; course_code: string | null; instructor: string | null };

type Found = { name: string; code: string; instructor: string; credits: number | null; pick: boolean; exists: boolean };

/** مواد الطالب في ترم: يضيفها الطالب لنفسه (studentId = null) أو الإدارة لطالب */
export function TermCoursesEditor({
  termId,
  studentId = null,
  courses,
  suggestions = [],
  classmates = {},
}: {
  termId: string;
  studentId?: string | null;
  courses: TermCourse[];
  suggestions?: string[];
  /** للإدارة: من يدرس المادة نفسها هذا الترم (معرّف المادة ← الأسماء) */
  classmates?: Record<string, string[]>;
}) {
  const router = useRouter();
  const listId = useId();
  const [name, setName] = useState("");
  const [instructor, setInstructor] = useState("");
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const [reading, setReading] = useState(false);
  const [found, setFound] = useState<Found[] | null>(null);
  const [foundNote, setFoundNote] = useState<{ skipped: string[]; cutOff: boolean; term: string | null }>({ skipped: [], cutOff: false, term: null });
  const fileInput = useRef<HTMLInputElement | null>(null);
  const existingKeys = new Set(courses.map((c) => c.course_name.trim().toLowerCase()));

  /** يقرأ المواد من صور تطبيق الجامعة أو جدول المحاضرات، ثم تُراجع قبل الحفظ */
  async function readImages(list: FileList | null) {
    if (!list?.length) return;
    setReading(true);
    try {
      const fd = new FormData();
      if (studentId) fd.set("studentId", studentId);
      for (const f of [...list].slice(0, 4)) {
        if (f.type === "application/pdf") fd.append("files", f);
        else if (f.type.startsWith("image/")) fd.append("files", new File([await compressImage(f, 1800, 0.85)], "courses.jpg", { type: "image/jpeg" }));
      }
      const res = await unwrap(readTermCoursesFromImages(fd));
      if (res.courses.length === 0) toast.error("لم أجد مواد في الصورة — جرّب لقطة أوضح أو أضفها يدوياً");
      setFound(
        res.courses.map((c) => {
          const exists = existingKeys.has(c.name.toLowerCase());
          return { ...c, instructor: c.instructor.slice(0, 80), code: c.code.slice(0, 20), pick: !exists, exists };
        })
      );
      setFoundNote({ skipped: res.skipped, cutOff: res.looksCutOff, term: res.termLabel });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّرت قراءة الصورة");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function saveFound() {
    const picked = (found ?? []).filter((f) => f.pick);
    if (!picked.length) return setFound(null);
    run(
      async () => {
        const r = await unwrap(addTermCourses({ studentId, termId, courses: picked.map((f) => ({ name: f.name, code: f.code, instructor: f.instructor })) }));
        toast.success(`أُضيفت ${r.added} مادة${r.skipped ? ` (${r.skipped} مسجّلة من قبل)` : ""}`);
      },
      () => setFound(null)
    );
  }

  function run(fn: () => Promise<unknown>, after?: () => void) {
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  function add() {
    if (name.trim().length < 2) return toast.error("اكتب اسم المادة");
    run(
      () => unwrap(addTermCourses({ studentId, termId, courses: [{ name, code, instructor }] })),
      () => {
        setName("");
        setInstructor("");
        setCode("");
      }
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {courses.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-xl border">
          {courses.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <BookOpen className="size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate font-medium" dir="auto">
                    {c.course_name}
                    {c.course_code && <span className="ms-1.5 text-xs text-muted-foreground">{c.course_code}</span>}
                  </span>
                  {c.instructor && (
                    <span className="block truncate text-xs text-muted-foreground" dir="auto">
                      {c.instructor}
                    </span>
                  )}
                  {classmates[c.id]?.length ? <span className="block text-xs text-primary">مع: {classmates[c.id].join("، ")}</span> : null}
                </span>
              </span>
              <Button variant="ghost" size="icon-sm" aria-label={`حذف ${c.course_name}`} disabled={isPending} onClick={() => run(() => unwrap(removeTermCourse(c.id)))}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">لم تُسجَّل مواد بعد.</p>
      )}

      {found && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> وجدتُ في الصورة{foundNote.term ? ` (${foundNote.term})` : ""} — راجعها قبل الحفظ
          </span>
          <ul className="flex flex-col gap-1">
            {found.map((f, i) => (
              <li key={i} className={cn("flex items-start gap-2 text-sm", f.exists && "opacity-60")}>
                <Checkbox
                  checked={f.pick}
                  disabled={f.exists}
                  onCheckedChange={(v) => setFound((prev) => prev && prev.map((x, j) => (j === i ? { ...x, pick: v === true } : x)))}
                  className="mt-0.5"
                  aria-label={f.name}
                />
                <span className="min-w-0">
                  <span className="block font-medium" dir="auto">
                    {f.name}
                    {f.code && <span className="ms-1.5 text-xs text-muted-foreground">{f.code}</span>}
                    {f.exists && <span className="ms-1.5 text-xs text-muted-foreground">(مسجّلة)</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground" dir="auto">
                    {[f.instructor, f.credits !== null ? `${f.credits} ساعة` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {foundNote.skipped.length > 0 && <p className="text-xs text-muted-foreground">تجاهلتُ ما ليس من هذا الترم: {foundNote.skipped.join("، ")}</p>}
          {foundNote.cutOff && (
            <p className="flex items-center gap-1.5 text-xs text-warning-foreground dark:text-warning">
              <AlertTriangle className="size-3.5" /> الصورة تبدو مقطوعة من الأسفل — أرسل لقطة للباقي إن وُجد
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={saveFound} disabled={isPending || !found.some((f) => f.pick)}>
              {isPending ? <Spinner /> : <Check />} إضافة المختار ({found.filter((f) => f.pick).length})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFound(null)} disabled={isPending}>
              إلغاء
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={reading || isPending}>
          {reading ? <Spinner /> : <ImageUp />} {reading ? "أقرأ الصورة…" : "قراءة المواد من صورة"}
        </Button>
        <span className="text-xs text-muted-foreground">لقطة من تطبيق الجامعة أو جدول المحاضرات — تُقرأ المواد والأساتذة تلقائياً</span>
        <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => readImages(e.target.files)} />
      </div>

      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_auto]">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          list={listId}
          placeholder="اسم المادة، مثل Linear Algebra"
          aria-label="اسم المادة"
          dir="auto"
          maxLength={120}
          className="h-9"
        />
        <Input value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="الأستاذ (اختياري)" aria-label="الأستاذ" dir="auto" maxLength={80} className="h-9" />
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="الرمز" aria-label="رمز المادة" dir="ltr" maxLength={20} className="h-9" />
        <Button onClick={add} disabled={isPending} className="h-9">
          {isPending ? <Spinner /> : <Plus />} إضافة
        </Button>
      </div>
    </div>
  );
}
