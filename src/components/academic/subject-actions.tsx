"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSubjectAction, deleteSubjectAction, setSubjectActionStatus } from "@/app/admin/academic/actions";
import { daysBetweenISO, formatShortDateISO } from "@/lib/date";
import type { RemediationStatus } from "@/lib/supabase/types";
import { toastOnError, unwrap } from "@/lib/unwrap";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type SubjectActionRow = {
  id: string;
  title: string;
  status: RemediationStatus;
  tutor_name: string | null;
  due_date: string | null;
  notes: string | null;
};

const STATUS: { value: RemediationStatus; label: string; active: string }[] = [
  { value: "planned", label: "مخطَّط", active: "bg-background text-foreground shadow-sm" },
  { value: "in_progress", label: "جارٍ", active: "bg-warning/25 text-warning-foreground shadow-sm dark:text-warning" },
  { value: "done", label: "تم", active: "bg-success text-success-foreground shadow-sm" },
];

const SUGGESTIONS = ["إحضار أستاذ تقوية", "تنظيم حصة مراجعة جماعية", "ربط المتعثرين بطالب قوي في المادة", "توفير مصادر ومذكرات"];

function ActionRow({ action, today }: { action: SubjectActionRow; today: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const overdue = action.status !== "done" && action.due_date !== null && daysBetweenISO(today, action.due_date) < 0;

  return (
    <li className={cn("flex flex-col gap-2 rounded-xl border p-3", action.status === "done" && "border-success/25 bg-success/[0.04]")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={cn("text-sm font-medium", action.status === "done" && "text-muted-foreground line-through")}>{action.title}</span>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {action.tutor_name && (
              <span className="flex items-center gap-1">
                <UserRound className="size-3" /> {action.tutor_name}
              </span>
            )}
            {action.due_date && (
              <span className={cn("flex items-center gap-1", overdue && "font-medium text-destructive")}>
                <CalendarClock className="size-3" /> {formatShortDateISO(action.due_date)}
                {overdue && " (متأخرة)"}
              </span>
            )}
          </div>
          {action.notes && <span className="text-xs text-muted-foreground">{action.notes}</span>}
        </div>

        <div className="flex items-center gap-1.5">
          <div role="radiogroup" aria-label="حالة الخطوة" className="flex gap-0.5 rounded-lg bg-muted/70 p-0.5">
            {STATUS.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={action.status === s.value}
                disabled={isPending}
                onClick={() => action.status !== s.value && startTransition(async () => void (await toastOnError(setSubjectActionStatus(action.id, s.value))))}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-all active:scale-95 disabled:opacity-60",
                  action.status === s.value ? s.active : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                setTimeout(() => setConfirming(false), 3000);
                return;
              }
              startTransition(async () => void (await toastOnError(deleteSubjectAction(action.id))));
            }}
            aria-label={confirming ? "تأكيد حذف الخطوة" : "حذف الخطوة"}
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors",
              confirming ? "bg-destructive text-white" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            )}
          >
            <Trash2 className="size-3.5" />
            {confirming && "تأكيد"}
          </button>
        </div>
      </div>
    </li>
  );
}

export function SubjectActions({
  subjectId,
  subjectName,
  actions,
  today,
}: {
  subjectId: string;
  subjectName: string;
  actions: SubjectActionRow[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [tutor, setTutor] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTitle("");
      setTutor("");
      setDue("");
      setNotes("");
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await unwrap(createSubjectAction({ subjectId, title, tutorName: tutor, dueDate: due || null, notes }));
        toast.success("أُضيفت خطوة المعالجة");
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذّرت الإضافة");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">خطوات المعالجة</span>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger
            render={
              <Button size="sm" variant="outline">
                <Plus /> خطوة معالجة
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>خطوة معالجة — {subjectName}</DialogTitle>
              <DialogDescription>ما الإجراء الذي ستتخذه لمعالجة التعثر المشترك في هذه المادة؟</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="a-title">الخطوة</FieldLabel>
                  <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTitle(s)}
                        className="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="a-tutor">الأستاذ / المسؤول (اختياري)</FieldLabel>
                    <Input id="a-tutor" value={tutor} onChange={(e) => setTutor(e.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="a-due">الموعد (اختياري)</FieldLabel>
                    <Input id="a-due" type="date" dir="ltr" className="text-start" value={due} onChange={(e) => setDue(e.target.value)} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="a-notes">ملاحظات (اختياري)</FieldLabel>
                  <Textarea id="a-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </FieldGroup>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={isPending || !title.trim()}>
                  {isPending && <Spinner />}
                  إضافة
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {actions.length === 0 ? (
        <p className="rounded-xl border border-dashed p-3 text-xs text-warning-foreground dark:text-warning">
          لم تُتخذ أي خطوة لمعالجة هذه المادة بعد.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {actions.map((a) => (
            <ActionRow key={a.id} action={a} today={today} />
          ))}
        </ul>
      )}
    </div>
  );
}
