import Link from "next/link";
import { AlertTriangle, Clock, GraduationCap, LifeBuoy, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  EditTutorButton,
  GroupSuggestionCard,
  SupportRequestCard,
  TutorDialog,
  type SupportRequestView,
  type TutorOption,
  type TutorRow,
} from "@/components/academic/support-board";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { todayISO } from "@/lib/date";
import { formatCredits, formatGpa } from "@/lib/grades";
import { subjectKey } from "@/lib/academic";
import { getScholarshipConfig } from "@/lib/scholarship-server";
import { PRIORITY_RANK, SUPPORT_STATUS_LABELS, type SupportPriority } from "@/lib/scholarship";

const OPEN = new Set(["open", "assigned", "in_progress"]);
const STATUS_TABS = ["open", "assigned", "in_progress", "resolved", "closed"] as const;

export default async function SupportPage({ searchParams }: PageProps<"/admin/academic/support">) {
  await requirePermission("academic");
  const { status: statusParam } = await searchParams;
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: requestRows }, { data: sessionRows }, { data: tutorRows }, { data: students }, { data: terms }, { settings }] = await Promise.all([
    supabase.from("academic_support_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("academic_tutoring_sessions").select("*").order("session_date", { ascending: false }),
    supabase.from("academic_tutors").select("*").order("full_name"),
    supabase.from("students").select("id, profiles!students_id_fkey(full_name)"),
    supabase.from("academic_terms").select("id, name"),
    getScholarshipConfig(supabase),
  ]);

  const nameById = new Map((students ?? []).map((s) => [s.id, (s.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"]));
  const termName = new Map((terms ?? []).map((t) => [t.id, t.name]));
  const tutors: TutorRow[] = (tutorRows ?? []).map((t) => ({
    id: t.id,
    fullName: t.full_name,
    phone: t.phone,
    subjects: t.subjects,
    hourlyRate: t.hourly_rate,
    currency: t.currency,
    rating: t.rating,
    notes: t.notes,
    isActive: t.is_active,
  }));
  const tutorName = new Map(tutors.map((t) => [t.id, t.fullName]));
  const tutorOptions: TutorOption[] = tutors.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.fullName, currency: t.currency, hourlyRate: t.hourlyRate }));

  const sessionsBy = new Map<string, SupportRequestView["sessions"]>();
  for (const s of sessionRows ?? []) {
    sessionsBy.set(s.request_id, [
      ...(sessionsBy.get(s.request_id) ?? []),
      { id: s.id, date: s.session_date, hours: Number(s.duration_hours), attended: s.attended, cost: s.cost === null ? null : Number(s.cost), note: s.note, tutorName: s.tutor_id ? (tutorName.get(s.tutor_id) ?? null) : null },
    ]);
  }

  const requests: SupportRequestView[] = (requestRows ?? []).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: nameById.get(r.student_id) ?? "—",
    subject: r.subject,
    description: r.description,
    status: r.status,
    priority: r.priority as SupportPriority | null,
    source: r.source,
    termName: r.term_id ? (termName.get(r.term_id) ?? null) : null,
    tutorId: r.tutor_id,
    notes: r.admin_notes,
    baselinePoints: r.baseline_points,
    baselinePercent: r.baseline_percent,
    outcomePoints: r.outcome_points,
    createdAt: r.created_at,
    sessions: sessionsBy.get(r.id) ?? [],
  }));

  const open = requests.filter((r) => OPEN.has(r.status));
  const urgentUnassigned = open.filter((r) => r.priority === "urgent" && !r.tutorId).length;
  const allSessions = [...sessionsBy.values()].flat();
  const totalHours = allSessions.reduce((a, s) => a + s.hours, 0);
  const totalCost = allSessions.reduce((a, s) => a + (s.cost ?? 0), 0);

  // مجموعات التقوية: مادة واحدة يتعثر فيها عدد كافٍ من الطلاب
  const groups = new Map<string, SupportRequestView[]>();
  for (const r of open) {
    const key = subjectKey(r.subject);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const groupSuggestions = [...groups.values()]
    .map((list) => [...new Map(list.map((r) => [r.studentId, r])).values()])
    .filter((list) => list.length >= settings.groupTutoringMin)
    .sort((a, b) => b.length - a.length);

  // أثر الدعم: الطلبات التي عُرفت نتيجتها
  const measured = requests.filter((r) => r.outcomePoints !== null && r.status !== "closed");
  const passRate = measured.length ? Math.round((measured.filter((r) => (r.outcomePoints ?? 0) > 0).length / measured.length) * 100) : null;
  const deltas = measured.filter((r) => r.baselinePoints !== null).map((r) => (r.outcomePoints as number) - (r.baselinePoints as number));
  const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  const supported = new Set(requests.filter((r) => r.sessions.length).map((r) => r.studentId));

  const activeTab = STATUS_TABS.find((s) => s === statusParam) ?? "open";
  const visible = requests
    .filter((r) => r.status === activeTab)
    .sort((a, b) => (b.priority ? PRIORITY_RANK[b.priority] : 0) - (a.priority ? PRIORITY_RANK[a.priority] : 0) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="stagger flex flex-col gap-6">
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="طلبات مفتوحة" value={open.length} icon={LifeBuoy} />
        <StatCard label="عاجلة بلا مدرّس" value={urgentUnassigned} icon={AlertTriangle} tone="destructive" />
        <StatCard label="ساعات الدعم" value={formatCredits(totalHours)} icon={Clock} tone="warning" hint={`${arNum(allSessions.length)} جلسة`} />
        <StatCard
          label="تكلفة الدعم"
          value={formatCredits(totalCost)}
          icon={Wallet}
          tone="gold"
          hint={supported.size ? `${formatCredits(totalCost / supported.size)} لكل طالب مدعوم` : undefined}
        />
      </div>

      {measured.length > 0 && (
        <section className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/[0.05] p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/12 text-success">
            <TrendingUp className="size-5" />
          </span>
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">أثر الدعم:</span> نجح {passRate}٪ من {arNum(measured.length)} مادة مدعومة عُرفت نتيجتها
            {avgDelta !== null && (
              <>
                ، ومتوسط التحسن <span className="font-semibold tabular-nums">{avgDelta >= 0 ? "+" : ""}{formatGpa(avgDelta)}</span> نقطة
              </>
            )}
            .
          </p>
        </section>
      )}

      {groupSuggestions.length > 0 && (
        <div className="flex flex-col gap-3">
          {groupSuggestions.map((list) => (
            <GroupSuggestionCard
              key={list[0].id}
              subject={list[0].subject}
              requests={list.map((r) => ({ id: r.id, studentId: r.studentId, studentName: r.studentName, tutorId: r.tutorId }))}
              tutors={tutorOptions}
              today={today}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="حالة الطلبات">
          {STATUS_TABS.map((st) => {
            const n = requests.filter((r) => r.status === st).length;
            return (
              <Link
                key={st}
                href={`/admin/academic/support?status=${st}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  st === activeTab ? "border-primary/40 bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {SUPPORT_STATUS_LABELS[st]} ({arNum(n)})
              </Link>
            );
          })}
        </nav>
        {visible.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <GraduationCap />
            </EmptyMedia>
            <EmptyTitle>لا طلبات هنا</EmptyTitle>
            <EmptyDescription>طلبات الدعم تُقترح تلقائياً عند تأكيد الكشوف للمواد الراسبة والمتعثرة، أو يطلبها الطالب بنفسه.</EmptyDescription>
          </Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visible.map((r) => (
              <SupportRequestCard key={r.id} request={r} tutors={tutorOptions} today={today} />
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle>المدرّسون الخصوصيون</CardTitle>
            <CardDescription>{tutors.length ? `${arNum(tutors.filter((t) => t.isActive).length)} متاح` : "أضف المدرّسين لتسند إليهم الطلبات"}</CardDescription>
          </div>
          <TutorDialog />
        </CardHeader>
        {tutors.length > 0 && (
          <CardContent>
            <ul className="flex flex-col divide-y">
              {tutors.map((t) => {
                const mine = allSessions.filter((s) => s.tutorName === t.fullName);
                return (
                  <li key={t.id} className={cn("flex flex-wrap items-center justify-between gap-2 py-2.5", !t.isActive && "opacity-50")}>
                    <div className="flex flex-col">
                      <span className="font-medium">{t.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {[t.subjects.join("، "), t.hourlyRate !== null ? `${t.hourlyRate} ${t.currency}/ساعة` : null, t.rating !== null ? `★ ${t.rating}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {mine.length > 0 && <span>{formatCredits(mine.reduce((a, s) => a + s.hours, 0))} ساعة</span>}
                      <EditTutorButton tutor={t} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
