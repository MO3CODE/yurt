"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  CircleDot,
  ListChecks,
  MoreHorizontal,
  OctagonAlert,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProgressRing } from "@/components/progress-ring";
import { Segmented } from "@/components/segmented";
import { PlanImportDialog } from "@/components/academic/plan-import-dialog";
import { createPlanItem, deletePlanItem, setPlanItemStatus, updatePlanItem } from "@/app/admin/academic/actions";
import { PLAN_STATUS_LABELS, TRACK_LABELS } from "@/lib/academic";
import { daysBetweenISO, formatShortDateISO } from "@/lib/date";
import type { PlanStatus, PlanTrack } from "@/lib/supabase/types";
import { toastOnError, unwrap } from "@/lib/unwrap";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type PlanItem = {
  id: string;
  track: PlanTrack;
  phase: string | null;
  title: string;
  notes: string | null;
  status: PlanStatus;
  due_date: string | null;
};

const TRACK_ORDER: PlanTrack[] = ["academic", "skills", "development", "other"];
const TRACK_STYLE: Record<PlanTrack, { chip: string; bar: string }> = {
  academic: { chip: "bg-primary/10 text-primary", bar: "bg-primary" },
  skills: { chip: "bg-gold/15 text-gold-foreground dark:text-gold", bar: "bg-gold" },
  development: { chip: "bg-success/12 text-success", bar: "bg-success" },
  other: { chip: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/50" },
};

const STATUS_ICON: Record<PlanStatus, { icon: LucideIcon; className: string }> = {
  todo: { icon: CircleDashed, className: "text-muted-foreground hover:text-primary" },
  in_progress: { icon: CircleDot, className: "text-warning-foreground dark:text-warning" },
  done: { icon: CircleCheck, className: "text-success" },
  blocked: { icon: OctagonAlert, className: "text-destructive" },
};
const NEXT_STATUS: Record<PlanStatus, PlanStatus> = { todo: "in_progress", in_progress: "done", done: "todo", blocked: "todo" };

type OptimisticAction = { type: "status"; id: string; status: PlanStatus } | { type: "delete"; id: string };

function dueInfo(item: PlanItem, today: string) {
  if (!item.due_date || item.status === "done") return null;
  const days = daysBetweenISO(today, item.due_date);
  if (days < 0) return { text: `متأخر ${-days} يوم`, className: "bg-destructive/10 text-destructive" };
  if (days === 0) return { text: "اليوم", className: "bg-warning/18 text-warning-foreground dark:text-warning" };
  if (days <= 7) return { text: `بعد ${days} يوم`, className: "bg-warning/18 text-warning-foreground dark:text-warning" };
  return { text: formatShortDateISO(item.due_date), className: "bg-muted text-muted-foreground" };
}

// ---------------------------------------------------------------------
// نافذة إضافة/تعديل بند
// ---------------------------------------------------------------------
function PlanItemDialog({
  editing,
  phases,
  onClose,
}: {
  editing: PlanItem | "new" | null;
  phases: string[];
  onClose: () => void;
}) {
  const item = editing && editing !== "new" ? editing : null;
  return (
    <Dialog open={editing !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {editing !== null && <PlanItemForm key={item?.id ?? "new"} item={item} phases={phases} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PlanItemForm({ item, phases, onClose }: { item: PlanItem | null; phases: string[]; onClose: () => void }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [track, setTrack] = useState<PlanTrack>(item?.track ?? "academic");
  const [phase, setPhase] = useState(item?.phase ?? "");
  const [due, setDue] = useState(item?.due_date ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = { track, phase: phase || null, title, notes: notes || null, dueDate: due || null };
    startTransition(async () => {
      try {
        await unwrap(item ? updatePlanItem(item.id, payload) : createPlanItem(payload));
        toast.success(item ? "حُفظ البند" : "أُضيف البند");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذّر الحفظ");
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{item ? "تعديل البند" : "بند جديد في الخطة"}</DialogTitle>
        <DialogDescription>حدّد المسار والموعد لتتابع إنجازه من لوحتك.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="p-title">البند</FieldLabel>
            <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </Field>
          <Field>
            <FieldLabel>المسار</FieldLabel>
            <Segmented
              label="المسار"
              value={track}
              onChange={setTrack}
              className="w-fit"
              options={TRACK_ORDER.map((t) => ({ value: t, label: TRACK_LABELS[t] }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="p-phase">المرحلة / المجموعة (اختياري)</FieldLabel>
              <Input id="p-phase" list="plan-phases" value={phase} onChange={(e) => setPhase(e.target.value)} />
              <datalist id="plan-phases">
                {phases.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field>
              <FieldLabel htmlFor="p-due">الموعد (اختياري)</FieldLabel>
              <Input id="p-due" type="date" dir="ltr" className="text-start" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="p-notes">ملاحظات (اختياري)</FieldLabel>
            <Textarea id="p-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </FieldGroup>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="submit" disabled={isPending || !title.trim()}>
            {isPending && <Spinner />}
            {item ? "حفظ" : "إضافة"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------
// اللوحة
// ---------------------------------------------------------------------
export function PlanBoard({ items, today }: { items: PlanItem[]; today: string }) {
  const [view, applyOptimistic] = useOptimistic(items, (state, action: OptimisticAction) =>
    action.type === "delete" ? state.filter((i) => i.id !== action.id) : state.map((i) => (i.id === action.id ? { ...i, status: action.status } : i))
  );
  const [, startTransition] = useTransition();
  const [trackFilter, setTrackFilter] = useState<PlanTrack | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "remaining" | "done">("all");
  const [editing, setEditing] = useState<PlanItem | "new" | null>(null);

  function setStatus(item: PlanItem, status: PlanStatus) {
    startTransition(async () => {
      applyOptimistic({ type: "status", id: item.id, status });
      await toastOnError(setPlanItemStatus(item.id, status));
    });
  }

  function remove(item: PlanItem) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id: item.id });
      await toastOnError(deletePlanItem(item.id));
    });
  }

  const stats = useMemo(() => {
    const count = (s: PlanStatus) => view.filter((i) => i.status === s).length;
    const overdue = view.filter((i) => i.status !== "done" && i.due_date && daysBetweenISO(today, i.due_date) < 0).length;
    const byTrack = TRACK_ORDER.map((t) => {
      const list = view.filter((i) => i.track === t);
      return { track: t, total: list.length, done: list.filter((i) => i.status === "done").length };
    }).filter((t) => t.total > 0);
    return { total: view.length, done: count("done"), progress: count("in_progress"), todo: count("todo"), blocked: count("blocked"), overdue, byTrack };
  }, [view, today]);

  const phases = useMemo(() => [...new Set(view.map((i) => i.phase).filter((p): p is string => !!p))], [view]);

  const filtered = view.filter(
    (i) =>
      (trackFilter === "all" || i.track === trackFilter) &&
      (statusFilter === "all" || (statusFilter === "done" ? i.status === "done" : i.status !== "done"))
  );

  // مسار ← مرحلة ← بنود (الترتيب كما رُفعت الخطة)
  const groups = TRACK_ORDER.map((track) => {
    const inTrack = filtered.filter((i) => i.track === track);
    const phaseNames = [...new Set(inTrack.map((i) => i.phase ?? ""))];
    return { track, phases: phaseNames.map((p) => ({ name: p, items: inTrack.filter((i) => (i.phase ?? "") === p) })) };
  }).filter((g) => g.phases.length > 0);

  const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="stagger flex flex-col gap-6">
      {view.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>لم تُرفع خطتك بعد</EmptyTitle>
          <EmptyDescription>الصق خطتك (من Word أو ملاحظاتك) فتتحول إلى بنود تتابع إنجازها، أو أضف بنودك واحداً واحداً.</EmptyDescription>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <PlanImportDialog existingCount={0} />
            <Button variant="outline" onClick={() => setEditing("new")}>
              <Plus /> إضافة بند
            </Button>
          </div>
        </Empty>
      ) : (
        <>
          {/* ملخص */}
          <div className="@container">
          <section className="flex flex-col gap-5 rounded-2xl border bg-card p-4 shadow-soft @2xl:flex-row @2xl:items-center @2xl:p-5">
            <div className="flex items-center gap-4">
              <ProgressRing value={stats.done} max={stats.total} size={92} stroke={9}>
                <span className="font-heading text-xl font-semibold tabular-nums">{percent}%</span>
              </ProgressRing>
              <div className="flex flex-col leading-tight">
                <span className="font-heading text-2xl font-semibold tabular-nums">
                  {stats.done}
                  <span className="text-base text-muted-foreground"> / {stats.total}</span>
                </span>
                <span className="text-sm text-muted-foreground">بنداً منجزاً</span>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-2 @2xl:grid-cols-4">
              {[
                { label: "قيد التنفيذ", value: stats.progress, className: "text-warning-foreground dark:text-warning" },
                { label: "لم يبدأ", value: stats.todo, className: "text-foreground" },
                { label: "متأخرة", value: stats.overdue, className: stats.overdue > 0 ? "text-destructive" : "text-muted-foreground" },
                { label: "متعثّرة", value: stats.blocked, className: stats.blocked > 0 ? "text-destructive" : "text-muted-foreground" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col rounded-xl bg-muted/50 p-3">
                  <span className={cn("font-heading text-xl font-semibold tabular-nums", s.className)}>{s.value}</span>
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="flex w-full flex-col gap-2 @2xl:w-52">
              {stats.byTrack.map((t) => (
                <div key={t.track} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{TRACK_LABELS[t.track]}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {t.done}/{t.total}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("animate-grow-x h-full rounded-full", TRACK_STYLE[t.track].bar)} style={{ width: `${(t.done / t.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
          </div>

          {/* أدوات */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="المسار"
                value={trackFilter}
                onChange={setTrackFilter}
                options={[{ value: "all" as PlanTrack | "all", label: "كل المسارات" }, ...stats.byTrack.map((t) => ({ value: t.track as PlanTrack | "all", label: TRACK_LABELS[t.track] }))]}
              />
              <Segmented
                label="الحالة"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "الكل" },
                  { value: "remaining", label: "المتبقي" },
                  { value: "done", label: "المنجز" },
                ]}
              />
            </div>
            <div className="flex gap-2">
              <PlanImportDialog existingCount={view.length} />
              <Button onClick={() => setEditing("new")}>
                <Plus /> إضافة بند
              </Button>
            </div>
          </div>

          {/* البنود */}
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا بنود تطابق هذا الفلتر.</p>
          ) : (
            groups.map((g) => (
              <section key={g.track} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", TRACK_STYLE[g.track].chip)}>{TRACK_LABELS[g.track]}</span>
                </h2>
                {g.phases.map((p) => (
                  <div key={p.name} className="flex flex-col gap-1.5">
                    {p.name && <h3 className="text-sm font-medium text-muted-foreground">{p.name}</h3>}
                    <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-soft">
                      {p.items.map((item) => {
                        const S = STATUS_ICON[item.status];
                        const due = dueInfo(item, today);
                        return (
                          <li key={item.id} className="flex items-start gap-3 p-3">
                            <button
                              type="button"
                              onClick={() => setStatus(item, NEXT_STATUS[item.status])}
                              aria-label={`${PLAN_STATUS_LABELS[item.status]} — اضغط لتغيير الحالة`}
                              title={`${PLAN_STATUS_LABELS[item.status]} — اضغط لتغيير الحالة`}
                              className={cn("mt-0.5 shrink-0 rounded-full transition-transform active:scale-90", S.className)}
                            >
                              <S.icon className="size-5" />
                            </button>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className={cn("text-sm font-medium", item.status === "done" && "text-muted-foreground line-through")}>{item.title}</span>
                              {item.notes && <span className="text-xs text-muted-foreground">{item.notes}</span>}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {item.status !== "todo" && item.status !== "done" && (
                                  <span className="text-xs text-muted-foreground">{PLAN_STATUS_LABELS[item.status]}</span>
                                )}
                                {due && (
                                  <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs", due.className)}>
                                    <CalendarClock className="size-3" />
                                    {due.text}
                                  </span>
                                )}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`خيارات: ${item.title}`} />}>
                                <MoreHorizontal />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuGroup>
                                  {(Object.keys(PLAN_STATUS_LABELS) as PlanStatus[])
                                    .filter((s) => s !== item.status)
                                    .map((s) => (
                                      <DropdownMenuItem key={s} onClick={() => setStatus(item, s)}>
                                        {(() => {
                                          const I = STATUS_ICON[s].icon;
                                          return <I />;
                                        })()}
                                        {PLAN_STATUS_LABELS[s]}
                                      </DropdownMenuItem>
                                    ))}
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                  <DropdownMenuItem onClick={() => setEditing(item)}>
                                    <Pencil /> تعديل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem variant="destructive" onClick={() => remove(item)}>
                                    <Trash2 /> حذف
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            ))
          )}
        </>
      )}

      <PlanItemDialog editing={editing} phases={phases} onClose={() => setEditing(null)} />
    </div>
  );
}
