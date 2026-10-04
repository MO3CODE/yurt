"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, FileSpreadsheet } from "lucide-react";
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
import { importAcademicData } from "@/app/admin/academic/actions";
import { IMPORT_SAMPLE, formatGpa, matchStudentByName, parseImportText } from "@/lib/academic";
import { unwrap } from "@/lib/unwrap";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ImportDialog({ students }: { students: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(
    () =>
      parseImportText(text).map((r) => {
        const match = matchStudentByName(r.name, students);
        const problem =
          match.kind === "none"
            ? "الاسم غير موجود بين الطلاب النشطين"
            : match.kind === "ambiguous"
              ? "الاسم ينطبق على أكثر من طالب — اكتبه كاملاً"
              : r.gpaInvalid
                ? "المعدل غير مفهوم"
                : null;
        return { ...r, studentId: match.kind === "match" ? match.id : null, problem };
      }),
    [text, students]
  );
  const ready = rows.filter((r) => !r.problem && r.studentId);
  const duplicates = new Set(ready.map((r) => r.studentId).filter((id, i, a) => a.indexOf(id) !== i));
  // آخر صف لكل طالب هو المعتمد
  const unique = [...new Map(ready.map((r) => [r.studentId!, r])).values()];

  function submit() {
    startTransition(async () => {
      try {
        const res = await unwrap(
          importAcademicData({
            rows: unique.map((r) => ({
              studentId: r.studentId!,
              gpa: r.gpa?.gpa ?? null,
              gpaScale: r.gpa?.scale ?? 4,
              strong: r.strong,
              struggling: r.struggling,
            })),
          })
        );
        toast.success(`تم تحديث ${res.students} طالب (${res.subjects} مادة)`);
        setText("");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الاستيراد");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline"><FileSpreadsheet /> استيراد من جدول</Button>} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>استيراد بيانات الطلاب الأكاديمية</DialogTitle>
          <DialogDescription>
            انسخ الجدول من Excel أو Google Sheets والصقه هنا بأربعة أعمدة: الاسم، المعدل، المواد القوية، المواد المتعثرة (المواد
            تُفصل بفاصلة). يكفي اسمان أو ثلاثة من اسم الطالب إن لم يتكرر.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={IMPORT_SAMPLE}
            className="font-mono text-xs leading-relaxed"
            dir="auto"
            aria-label="الصق الجدول هنا"
          />
          {text.trim() === "" && (
            <button type="button" onClick={() => setText(IMPORT_SAMPLE)} className="w-fit text-xs text-primary hover:underline">
              ضع مثالاً لأرى الصيغة
            </button>
          )}

          {rows.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {unique.length} طالب جاهز للاستيراد
                {rows.length - ready.length > 0 && <span className="text-destructive"> · {rows.length - ready.length} يحتاج تصحيحاً (يُتجاهل)</span>}
              </p>
              <ul className="flex max-h-60 flex-col divide-y overflow-y-auto rounded-xl border">
                {rows.map((r) => (
                  <li key={r.line} className={cn("flex items-start gap-2.5 p-2.5 text-sm", r.problem && "bg-destructive/[0.04]")}>
                    <span className={cn("mt-0.5 shrink-0", r.problem ? "text-destructive" : "text-success")}>
                      {r.problem ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-medium">{r.name}</span>
                      {r.problem ? (
                        <span className="text-xs text-destructive">{r.problem}</span>
                      ) : (
                        <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <span dir="ltr">{r.gpa ? formatGpa(r.gpa.gpa, r.gpa.scale) : "بلا معدل"}</span>
                          <span>قوي في {r.strong.length}</span>
                          <span>متعثر في {r.struggling.length}</span>
                          {r.studentId && duplicates.has(r.studentId) && <span className="text-warning-foreground dark:text-warning">مكرر — يُعتمد آخر صف</span>}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                المواد المذكورة في الصف تحلّ محل مواد الطالب الحالية؛ وإن خلا الصف من المواد تبقى مواده كما هي.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button disabled={isPending || unique.length === 0} onClick={submit}>
            {isPending && <Spinner />}
            استيراد {unique.length > 0 ? `${unique.length} طالب` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
