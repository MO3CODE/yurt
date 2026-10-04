"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, MessageCircle, PhoneOff, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { logReminder } from "@/app/admin/academic/actions";
import { REMINDER_KINDS, REMINDER_VARIABLES, fillTemplate, firstName, type ReminderKind } from "@/lib/academic";
import { daysBetweenISO, formatLongDateISO } from "@/lib/date";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { toastOnError } from "@/lib/unwrap";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ComposerStudent = {
  id: string;
  name: string;
  phone: string | null;
  nextSession: string | null;
  /** يوم آخر تحديث لملفه الأكاديمي، أو null إن لم يُدخل ملفه */
  profileUpdatedDay: string | null;
  /** معرّفات المواد المتعثر فيها */
  struggling: string[];
  /** يوم آخر تذكير لكل نوع (YYYY-MM-DD) */
  lastSent: Partial<Record<ReminderKind, string>>;
};

type Target = "session_soon" | "no_session" | "stale" | "subject" | "all";

const TARGETS: { key: Target; label: string }[] = [
  { key: "session_soon", label: "جلسته خلال ٧ أيام أو متأخرة" },
  { key: "no_session", label: "بلا موعد جلسة" },
  { key: "stale", label: "لم يُحدَّث ملفه منذ ٣٠ يوماً" },
  { key: "subject", label: "متعثر في مادة" },
  { key: "all", label: "كل الطلاب" },
];

const DEFAULT_TARGET: Record<ReminderKind, Target> = {
  session: "session_soon",
  grades: "stale",
  tutoring: "subject",
  custom: "all",
};

export function ReminderComposer({
  students,
  subjects,
  today,
  initialKind,
  initialSubject,
  initialStudent,
}: {
  students: ComposerStudent[];
  subjects: { id: string; name: string; count: number }[];
  today: string;
  initialKind: ReminderKind;
  initialSubject: string | null;
  initialStudent: string | null;
}) {
  const [kind, setKind] = useState<ReminderKind>(initialKind);
  const [target, setTarget] = useState<Target>(initialStudent ? "all" : DEFAULT_TARGET[initialKind]);
  const [subjectId, setSubjectId] = useState<string>(initialSubject ?? subjects[0]?.id ?? "");
  const [manualDate, setManualDate] = useState("");
  const [message, setMessage] = useState(REMINDER_KINDS.find((k) => k.kind === initialKind)!.template);
  const [focusStudent, setFocusStudent] = useState<string | null>(initialStudent);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "";
  const needsDate = message.includes("{date}");
  const needsSubject = message.includes("{subject}");
  const showSubjectPicker = subjects.length > 0 && (target === "subject" || needsSubject);

  function chooseKind(next: ReminderKind) {
    setKind(next);
    setTarget(DEFAULT_TARGET[next]);
    setMessage(REMINDER_KINDS.find((k) => k.kind === next)!.template);
  }

  const rows = useMemo(() => {
    const out: {
      s: ComposerStudent;
      reason: string;
      sortKey: number;
      text: string;
      blocked: "no_phone" | "no_date" | "no_subject" | null;
      isSent: boolean;
      lastNote: string | null;
    }[] = [];

    for (const s of students) {
      const days = s.nextSession ? daysBetweenISO(today, s.nextSession) : null;
      let include = false;
      let reason = "";
      let sortKey = 0;

      if (target === "session_soon") {
        include = days !== null && days <= 7;
        reason = days === null ? "" : days < 0 ? `جلسته متأخرة ${-days} يوم` : days === 0 ? "جلسته اليوم" : `جلسته بعد ${days} يوم`;
        sortKey = days ?? 0;
      } else if (target === "no_session") {
        include = days === null;
        reason = "لا موعد جلسة";
      } else if (target === "stale") {
        const age = s.profileUpdatedDay ? daysBetweenISO(s.profileUpdatedDay, today) : null;
        include = age === null || age >= 30;
        reason = age === null ? "لم تُدخل بياناته بعد" : `آخر تحديث منذ ${age} يوم`;
        sortKey = -(age ?? 9999);
      } else if (target === "subject") {
        include = !!subjectId && s.struggling.includes(subjectId);
        reason = `متعثر في ${subjectName}`;
      } else {
        include = true;
      }
      if (focusStudent) include = s.id === focusStudent;
      if (!include) continue;

      const dateText = kind === "session" ? (s.nextSession ? formatLongDateISO(s.nextSession) : "") : manualDate.trim();
      const text = fillTemplate(message, { name: firstName(s.name), date: dateText, subject: subjectName });
      const blocked = !s.phone ? "no_phone" : needsDate && !dateText ? "no_date" : needsSubject && !subjectName ? "no_subject" : null;
      const last = s.lastSent[kind];
      const isSent = sent.has(`${s.id}:${kind}`) || last === today;
      const lastNote = !isSent && last ? `آخر تذكير: قبل ${daysBetweenISO(last, today)} يوم` : null;
      out.push({ s, reason, sortKey, text, blocked, isSent, lastNote });
    }
    return out.sort((a, b) => a.sortKey - b.sortKey || a.s.name.localeCompare(b.s.name, "ar"));
  }, [students, target, subjectId, subjectName, focusStudent, kind, manualDate, message, needsDate, needsSubject, sent, today]);

  const sendable = rows.filter((r) => !r.blocked);
  const pending = sendable.filter((r) => !r.isSent);
  const previewRow = pending[0] ?? sendable[0] ?? null;
  const previewText = previewRow
    ? previewRow.text
    : fillTemplate(message, { name: "أحمد", date: manualDate.trim() || "{date}", subject: subjectName || "{subject}" });

  function markSent(row: (typeof rows)[number]) {
    setSent((prev) => new Set(prev).add(`${row.s.id}:${kind}`));
    startTransition(async () => {
      await toastOnError(
        logReminder({
          studentId: row.s.id,
          kind,
          subjectId: (kind === "tutoring" || needsSubject) && subjectId ? subjectId : null,
          message: row.text,
        })
      );
    });
  }

  function sendNext() {
    const next = pending[0];
    if (!next?.s.phone) return;
    window.open(buildWhatsAppLink(next.s.phone, next.text), "_blank", "noopener,noreferrer");
    markSent(next);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("نُسخت الرسالة");
    } catch {
      toast.error("تعذّر النسخ");
    }
  }

  return (
    <div className="@container">
    <div className="grid gap-5 @4xl:grid-cols-5">
      {/* ===== الرسالة ===== */}
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5 @4xl:col-span-2">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">نوع التذكير</span>
          <div role="radiogroup" aria-label="نوع التذكير" className="grid grid-cols-2 gap-2">
            {REMINDER_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={kind === k.kind}
                onClick={() => chooseKind(k.kind)}
                className={cn(
                  "flex flex-col gap-0.5 rounded-xl border p-2.5 text-start transition-all active:scale-[0.98]",
                  kind === k.kind ? "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/30" : "hover:border-primary/25"
                )}
              >
                <span className="text-sm font-medium">{k.label}</span>
                <span className="text-xs leading-snug text-muted-foreground">{k.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">المستهدفون</span>
          <div className="flex flex-wrap gap-1.5">
            {TARGETS.filter((t) => t.key !== "subject" || subjects.length > 0).map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={target === t.key && !focusStudent}
                onClick={() => {
                  setTarget(t.key);
                  setFocusStudent(null);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  target === t.key && !focusStudent ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40 hover:text-primary"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {focusStudent && (
            <button
              type="button"
              onClick={() => setFocusStudent(null)}
              className="flex w-fit items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold-foreground dark:text-gold"
            >
              طالب واحد فقط <X className="size-3" />
            </button>
          )}
        </div>

        {showSubjectPicker && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">المادة</span>
            <Select
              value={subjectId}
              onValueChange={(v) => v && setSubjectId(v)}
              items={subjects.map((s) => ({ value: s.id, label: `${s.name} (${s.count})` }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر المادة" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {needsDate && kind !== "session" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">الموعد</span>
            <Input value={manualDate} onChange={(e) => setManualDate(e.target.value)} placeholder="مثال: الخميس الساعة ٥ مساءً" />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">نص الرسالة</span>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} aria-label="نص الرسالة" className="leading-relaxed" />
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>أدرج:</span>
            {REMINDER_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setMessage((m) => `${m}{${v.key}}`)}
                className="rounded-full border px-2 py-0.5 transition-colors hover:border-primary/40 hover:text-primary"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* معاينة بشكل رسالة واتساب */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">معاينة{previewRow ? ` — ${firstName(previewRow.s.name)}` : ""}</span>
          <div className="rounded-2xl rounded-ss-sm bg-[oklch(0.93_0.06_150)] p-3 text-sm leading-relaxed whitespace-pre-line text-[oklch(0.25_0.03_150)] dark:bg-[oklch(0.35_0.06_160)] dark:text-[oklch(0.95_0.02_150)]">
            {previewText}
          </div>
        </div>
      </section>

      {/* ===== المستلمون ===== */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:p-5 @4xl:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-base font-semibold">المستلمون ({rows.length})</span>
            <span className="text-xs text-muted-foreground">
              {sendable.length - pending.length} أُرسل · {pending.length} متبقٍ
              {rows.length - sendable.length > 0 && ` · ${rows.length - sendable.length} لا يمكن إرسالها`}
            </span>
          </div>
          <Button onClick={sendNext} disabled={pending.length === 0}>
            <Send /> {pending.length > 0 ? `أرسل للتالي (${firstName(pending[0].s.name)})` : "اكتمل الإرسال"}
          </Button>
        </div>

        {rows.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <MessageCircle />
            </EmptyMedia>
            <EmptyTitle>لا يوجد مستهدفون</EmptyTitle>
            <EmptyDescription>لا طلاب يطابقون هذا الفلتر الآن — جرّب فلتراً آخر.</EmptyDescription>
          </Empty>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border">
            {rows.map((r) => (
              <li key={r.s.id} className={cn("flex flex-wrap items-center justify-between gap-2 p-3", r.isSent && "bg-success/[0.04]")}>
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-medium">{r.s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[r.reason, r.lastNote].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>

                {r.blocked === "no_phone" ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <PhoneOff className="size-3.5" /> لا يوجد رقم جوال
                  </span>
                ) : r.blocked ? (
                  <span className="text-xs text-warning-foreground dark:text-warning">
                    {r.blocked === "no_date" ? (kind === "session" ? "لم يُحدَّد موعد جلسته" : "اكتب الموعد أولاً") : "اختر المادة أولاً"}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {r.isSent && (
                      <span className="flex items-center gap-1 text-xs font-medium text-success">
                        <Check className="size-3.5" /> أُرسلت
                      </span>
                    )}
                    <Button variant="ghost" size="icon-sm" aria-label={`نسخ رسالة ${r.s.name}`} onClick={() => copy(r.text)}>
                      <Copy />
                    </Button>
                    <Button
                      size="sm"
                      variant={r.isSent ? "outline" : "default"}
                      nativeButton={false}
                      render={<a href={buildWhatsAppLink(r.s.phone!, r.text)} target="_blank" rel="noopener noreferrer" />}
                      onClick={() => markSent(r)}
                    >
                      <MessageCircle /> {r.isSent ? "إعادة" : "واتساب"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
    </div>
  );
}
