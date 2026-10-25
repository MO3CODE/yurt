"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { addTermCourses, removeTermCourse } from "@/app/term-courses-actions";
import { unwrap } from "@/lib/unwrap";

export type TermCourse = { id: string; course_name: string; course_code: string | null; instructor: string | null };

/** مواد الطالب في ترم: يضيفها الطالب لنفسه (studentId = null) أو الإدارة لطالب */
export function TermCoursesEditor({
  termId,
  studentId = null,
  courses,
  suggestions = [],
}: {
  termId: string;
  studentId?: string | null;
  courses: TermCourse[];
  suggestions?: string[];
}) {
  const router = useRouter();
  const listId = useId();
  const [name, setName] = useState("");
  const [instructor, setInstructor] = useState("");
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

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
