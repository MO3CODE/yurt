"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Pencil, Plus, Save, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { addTutoringSession, assignGroup, deleteTutoringSession, saveTutor, updateSupportRequest } from "@/app/admin/academic/support-actions";
import { cn } from "@/lib/utils";
import { formatShortDateISO } from "@/lib/date";
import { formatCredits, formatGpa, parseGpa } from "@/lib/grades";
import { PRIORITY_META, SUPPORT_STATUS_LABELS, type SupportPriority } from "@/lib/scholarship";
import { unwrap } from "@/lib/unwrap";
import type { SupportStatus } from "@/lib/supabase/types";

export type TutorOption = { id: string; name: string; currency: string; hourlyRate: number | null };

export type SupportSession = { id: string; date: string; hours: number; attended: boolean; cost: number | null; note: string | null; tutorName: string | null };

export type SupportRequestView = {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  description: string | null;
  status: string;
  priority: SupportPriority | null;
  source: string;
  termName: string | null;
  tutorId: string | null;
  notes: string | null;
  baselinePoints: number | null;
  baselinePercent: number | null;
  outcomePoints: number | null;
  createdAt: string;
  sessions: SupportSession[];
};

const SOURCE_LABELS: Record<string, string> = { auto: "تلقائي من الكشف", student: "طلب الطالب", staff: "الإدارة" };
const NONE = "__none";

function useRun() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>, ok: string, after?: () => void) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        after?.();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر التنفيذ");
      }
    });
  return { isPending, run };
}

function TutorSelect({ tutors, value, onChange }: { tutors: TutorOption[]; value: string | null; onChange: (v: string | null) => void }) {
  const items = [{ value: NONE, label: "بلا مدرّس" }, ...tutors.map((t) => ({ value: t.id, label: t.name }))];
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(!v || v === NONE ? null : (v as string))} items={items}>
      <SelectTrigger className="w-full" aria-label="المدرّس">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** تسجيل جلسة لطلب واحد أو لمجموعة */
export function TutoringSessionDialog({
  requestIds,
  tutors,
  defaultTutorId,
  today,
  title,
  trigger,
}: {
  requestIds: string[];
  tutors: TutorOption[];
  defaultTutorId: string | null;
  today: string;
  title: string;
  trigger: React.ReactElement;
}) {
  const { isPending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [tutorId, setTutorId] = useState(defaultTutorId);
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState("1");
  const [attended, setAttended] = useState(true);
  const tutor = tutors.find((t) => t.id === tutorId);
  const [cost, setCost] = useState("");
  const suggested = tutor?.hourlyRate != null ? tutor.hourlyRate * (parseGpa(hours) || 0) : null;

  function save() {
    const h = parseGpa(hours);
    if (h === null || Number.isNaN(h) || h <= 0) return toast.error("المدة بالساعات، مثل 1.5");
    const c = cost.trim() ? parseGpa(cost) : suggested;
    if (c !== null && (Number.isNaN(c) || c < 0)) return toast.error("التكلفة رقم");
    run(
      () => unwrap(addTutoringSession({ requestIds, tutorId, date, hours: h, attended, cost: c, note: "" })),
      "سُجّلت الجلسة",
      () => setOpen(false)
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{requestIds.length > 1 ? `تكلفة الجلسة تُقسم على ${requestIds.length} طلاب` : "جلسة تقوية فردية"}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>المدرّس</Label>
            <TutorSelect tutors={tutors} value={tutorId} onChange={setTutorId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ts-date">التاريخ</Label>
              <Input id="ts-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ts-hours">المدة (ساعة)</Label>
              <Input id="ts-hours" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" dir="ltr" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ts-cost">التكلفة الكلية {tutor ? `(${tutor.currency})` : ""}</Label>
            <Input
              id="ts-cost"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              inputMode="decimal"
              dir="ltr"
              placeholder={suggested !== null ? String(suggested) : "اختياري"}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={attended} onCheckedChange={(v) => setAttended(v === true)} /> حضر الطالب
          </label>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={isPending}>
            {isPending ? <Spinner /> : <CalendarPlus />} تسجيل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SupportRequestCard({ request, tutors, today }: { request: SupportRequestView; tutors: TutorOption[]; today: string }) {
  const { isPending, run } = useRun();
  const [status, setStatus] = useState(request.status);
  const [priority, setPriority] = useState<SupportPriority | null>(request.priority);
  const [tutorId, setTutorId] = useState(request.tutorId);
  const [notes, setNotes] = useState(request.notes ?? "");
  const hours = request.sessions.reduce((a, s) => a + s.hours, 0);
  const cost = request.sessions.reduce((a, s) => a + (s.cost ?? 0), 0);
  const baseline = request.baselinePoints !== null ? formatGpa(request.baselinePoints) : request.baselinePercent !== null ? `${request.baselinePercent}٪` : null;
  const statusItems = Object.entries(SUPPORT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  const priorityItems = [{ value: NONE, label: "بلا أولوية" }, ...Object.entries(PRIORITY_META).map(([value, m]) => ({ value, label: m.label }))];

  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{request.subject}</span>
          <Link href={`/admin/academic/${request.studentId}`} className="text-sm text-muted-foreground hover:underline">
            {request.studentName}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {request.priority && <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PRIORITY_META[request.priority].className)}>{PRIORITY_META[request.priority].label}</span>}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{SOURCE_LABELS[request.source] ?? request.source}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {request.termName && <span>{request.termName}</span>}
        {baseline && <span>قبل الدعم: {baseline}</span>}
        {request.outcomePoints !== null && (
          <span className={request.outcomePoints > 0 ? "text-success" : "text-destructive"}>بعد الدعم: {formatGpa(request.outcomePoints)}</span>
        )}
        {request.sessions.length > 0 && (
          <span>
            {request.sessions.length} جلسة · {formatCredits(hours)} ساعة{cost ? ` · تكلفة ${formatCredits(cost)}` : ""}
          </span>
        )}
      </div>
      {request.description && <p className="text-sm text-muted-foreground">{request.description}</p>}

      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={status} onValueChange={(v) => v && setStatus(v as string)} items={statusItems}>
          <SelectTrigger className="w-full" aria-label="الحالة">
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
        <Select value={priority ?? NONE} onValueChange={(v) => setPriority(!v || v === NONE ? null : (v as SupportPriority))} items={priorityItems}>
          <SelectTrigger className="w-full" aria-label="الأولوية">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {priorityItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TutorSelect tutors={tutors} value={tutorId} onChange={setTutorId} />
      </div>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} placeholder="ملاحظات (وسبب الرفض أو الإلغاء إن وُجد)" />

      {request.sessions.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border text-xs">
          {request.sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <span>
                {formatShortDateISO(s.date)} · {formatCredits(s.hours)} ساعة{s.tutorName ? ` · ${s.tutorName}` : ""}
                {!s.attended && <span className="text-destructive"> · غاب</span>}
                {s.cost !== null && <span className="text-muted-foreground"> · {formatCredits(s.cost)}</span>}
              </span>
              <Button variant="ghost" size="icon-xs" aria-label="حذف الجلسة" disabled={isPending} onClick={() => run(() => unwrap(deleteTutoringSession(s.id)), "حُذفت الجلسة")}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => run(() => unwrap(updateSupportRequest({ id: request.id, status: status as SupportStatus, priority, tutorId, notes })), "حُفظ الطلب")}
        >
          {isPending ? <Spinner /> : <Save />} حفظ
        </Button>
        {request.status !== "closed" && request.status !== "resolved" && (
          <TutoringSessionDialog
            requestIds={[request.id]}
            tutors={tutors}
            defaultTutorId={request.tutorId}
            today={today}
            title={`جلسة — ${request.subject}`}
            trigger={
              <Button size="sm" variant="outline">
                <CalendarPlus /> جلسة
              </Button>
            }
          />
        )}
      </div>
    </article>
  );
}

/** اقتراح مجموعة تقوية: نفس المادة لعدة طلاب بمدرّس واحد */
export function GroupSuggestionCard({
  subject,
  requests,
  tutors,
  today,
}: {
  subject: string;
  requests: { id: string; studentId: string; studentName: string; tutorId: string | null }[];
  tutors: TutorOption[];
  today: string;
}) {
  const { isPending, run } = useRun();
  const shared = requests.every((r) => r.tutorId && r.tutorId === requests[0].tutorId) ? requests[0].tutorId : null;
  const [tutorId, setTutorId] = useState<string | null>(shared);
  const ids = requests.map((r) => r.id);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gold/40 bg-gold/[0.06] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <Users className="size-4" /> مجموعة تقوية: {subject}
        </span>
        <span className="text-xs text-muted-foreground">{requests.length} طلاب — مدرّس واحد بدل دروس فردية</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {requests.map((r) => (
          <Link key={r.id} href={`/admin/academic/${r.studentId}`} className="rounded-full bg-card px-2.5 py-1 text-xs hover:bg-muted">
            {r.studentName}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-56">
          <TutorSelect tutors={tutors} value={tutorId} onChange={setTutorId} />
        </div>
        <Button
          size="sm"
          disabled={isPending || !tutorId}
          onClick={() => tutorId && run(() => unwrap(assignGroup({ ids, tutorId })), `أُسندت مجموعة ${subject}`)}
        >
          {isPending ? <Spinner /> : <Users />} إسناد للمجموعة
        </Button>
        <TutoringSessionDialog
          requestIds={ids}
          tutors={tutors}
          defaultTutorId={tutorId}
          today={today}
          title={`جلسة مجموعة — ${subject}`}
          trigger={
            <Button size="sm" variant="outline">
              <CalendarPlus /> جلسة للمجموعة
            </Button>
          }
        />
      </div>
    </section>
  );
}

export type TutorRow = {
  id: string;
  fullName: string;
  phone: string | null;
  subjects: string[];
  hourlyRate: number | null;
  currency: string;
  rating: number | null;
  notes: string | null;
  isActive: boolean;
};

export function TutorDialog({ tutor, trigger }: { tutor?: TutorRow; trigger?: React.ReactElement }) {
  const { isPending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(tutor?.fullName ?? "");
  const [phone, setPhone] = useState(tutor?.phone ?? "");
  const [subjects, setSubjects] = useState((tutor?.subjects ?? []).join("، "));
  const [rate, setRate] = useState(tutor?.hourlyRate != null ? String(tutor.hourlyRate) : "");
  const [currency, setCurrency] = useState(tutor?.currency ?? "TRY");
  const [rating, setRating] = useState(tutor?.rating != null ? String(tutor.rating) : "");
  const [notes, setNotes] = useState(tutor?.notes ?? "");
  const [isActive, setIsActive] = useState(tutor?.isActive ?? true);

  function save() {
    const r = rate.trim() ? parseGpa(rate) : null;
    const g = rating.trim() ? parseGpa(rating) : null;
    if (r !== null && (Number.isNaN(r) || r < 0)) return toast.error("سعر الساعة رقم");
    if (g !== null && (Number.isNaN(g) || g < 0 || g > 5)) return toast.error("التقييم من ٠ إلى ٥");
    run(
      () =>
        unwrap(
          saveTutor({
            id: tutor?.id ?? null,
            fullName,
            phone,
            subjects: subjects.split(/[،,\n]+/).map((s) => s.trim()).filter(Boolean),
            hourlyRate: r,
            currency,
            rating: g,
            notes,
            isActive,
          })
        ),
      tutor ? "حُفظ المدرّس" : "أُضيف المدرّس",
      () => setOpen(false)
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline">
              <Plus /> مدرّس
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tutor ? "تعديل مدرّس" : "مدرّس خصوصي جديد"}</DialogTitle>
          <DialogDescription>يظهر في قائمة الإسناد لطلبات الدعم</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tu-name">الاسم</Label>
            <Input id="tu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tu-phone">الهاتف</Label>
            <Input id="tu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" maxLength={30} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tu-subj">المواد التي يدرّسها</Label>
            <Input id="tu-subj" value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="Matematik، Fizik" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tu-rate">سعر الساعة</Label>
              <Input id="tu-rate" value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tu-cur">العملة</Label>
              <Input id="tu-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} dir="ltr" maxLength={5} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tu-rating">التقييم /٥</Label>
              <Input id="tu-rating" value={rating} onChange={(e) => setRating(e.target.value)} inputMode="decimal" dir="ltr" />
            </div>
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="ملاحظات" />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} /> متاح للإسناد
          </label>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={isPending}>
            {isPending ? <Spinner /> : <Save />} حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditTutorButton({ tutor }: { tutor: TutorRow }) {
  return (
    <TutorDialog
      tutor={tutor}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${tutor.fullName}`}>
          <Pencil />
        </Button>
      }
    />
  );
}
