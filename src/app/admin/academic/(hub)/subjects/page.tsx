import Link from "next/link";
import { BookOpenCheck, ClipboardCheck, Lightbulb, MessageCircle, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { SubjectActions, type SubjectActionRow } from "@/components/academic/subject-actions";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string };

export default async function SharedSubjectsPage() {
  await requirePermission("academic");
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: subjects }, { data: links }, { data: students }, { data: actions }, { data: profiles }] = await Promise.all([
    supabase.from("academic_subjects").select("id, name"),
    supabase.from("student_subjects").select("student_id, subject_id, standing"),
    supabase.from("students").select("id, profiles!students_id_fkey(full_name)").eq("status", "active"),
    supabase.from("subject_actions").select("id, subject_id, title, status, tutor_name, due_date, notes").order("created_at"),
    supabase.from("student_academic_profiles").select("student_id"),
  ]);

  const nameById = new Map<string, string>(
    (students ?? []).map((s) => [s.id, (s.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"])
  );
  const activeLinks = (links ?? []).filter((l) => nameById.has(l.student_id));
  const tracked = new Set([...activeLinks.map((l) => l.student_id), ...(profiles ?? []).map((p) => p.student_id).filter((id) => nameById.has(id))]);

  const cards = (subjects ?? [])
    .map((s) => {
      const forSubject = activeLinks.filter((l) => l.subject_id === s.id);
      const toPeople = (standing: "strong" | "struggling"): Person[] =>
        forSubject
          .filter((l) => l.standing === standing)
          .map((l) => ({ id: l.student_id, name: nameById.get(l.student_id) ?? "—" }))
          .sort((a, b) => a.name.localeCompare(b.name, "ar"));
      return {
        id: s.id,
        name: s.name,
        struggling: toPeople("struggling"),
        strong: toPeople("strong"),
        actions: (actions ?? []).filter((a) => a.subject_id === s.id) as SubjectActionRow[],
      };
    })
    .filter((c) => c.struggling.length > 0)
    .sort((a, b) => b.struggling.length - a.struggling.length || a.name.localeCompare(b.name, "ar"));

  const shared = cards.filter((c) => c.struggling.length >= 2);
  const visibleActions = cards.flatMap((c) => c.actions);
  const top = cards[0];

  if (cards.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <BookOpenCheck />
        </EmptyMedia>
        <EmptyTitle>لا توجد مواد متعثَّر فيها بعد</EmptyTitle>
        <EmptyDescription>
          أدخل بيانات الطلاب من{" "}
          <Link href="/admin/academic" className="underline underline-offset-4">
            تبويب الطلاب
          </Link>
          ، وسيُجمَّع هنا تلقائياً ما يتعثر فيه أكثر من طالب لتعالجه.
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="stagger flex flex-col gap-6">
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="مواد يتعثر فيها طلاب" value={cards.length} icon={BookOpenCheck} />
        <StatCard label="مواد مشتركة (٢ طالب فأكثر)" value={shared.length} icon={Users} tone="destructive" />
        <StatCard label="خطوات قيد التنفيذ" value={visibleActions.filter((a) => a.status === "in_progress").length} icon={ClipboardCheck} tone="warning" />
        <StatCard label="خطوات منجزة" value={visibleActions.filter((a) => a.status === "done").length} icon={ClipboardCheck} tone="success" />
      </div>

      {top && top.struggling.length >= 2 && (
        <section className="flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold/[0.07] p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-foreground dark:text-gold">
            <Lightbulb className="size-5" />
          </span>
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">أكثر المواد تعثراً: {top.name}</span> — يتعثر فيها {top.struggling.length} من أصل {tracked.size} طالب
            ({Math.round((top.struggling.length / Math.max(1, tracked.size)) * 100)}٪).{" "}
            {top.actions.length === 0
              ? "لم تُتخذ خطوة معالجة بعد؛ أضف خطوة مثل «إحضار أستاذ تقوية» من البطاقة أدناه."
              : `خطوات المعالجة المسجَّلة: ${top.actions.length}.`}
          </p>
        </section>
      )}

      <div className="flex flex-col gap-4">
        {cards.map((c) => {
          const share = Math.round((c.struggling.length / Math.max(1, tracked.size)) * 100);
          const isShared = c.struggling.length >= 2;
          return (
            <section key={c.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-lg font-semibold">{c.name}</h3>
                    {isShared && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">مادة مشتركة</span>
                    )}
                    {c.actions.length === 0 && (
                      <span className="rounded-full bg-warning/18 px-2 py-0.5 text-xs font-medium text-warning-foreground dark:text-warning">
                        بلا خطوة معالجة
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {c.struggling.length} طالب متعثر · {share}٪ من المتابَعين
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/admin/academic/reminders?kind=tutoring&subject=${c.id}`} />}
                >
                  <MessageCircle /> تذكير بحصة تقوية
                </Button>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("animate-grow-x h-full rounded-full", isShared ? "bg-destructive" : "bg-warning")} style={{ width: `${Math.max(4, share)}%` }} />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {c.struggling.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/academic/${p.id}`}
                    className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive transition-colors hover:bg-destructive/20"
                  >
                    {p.name}
                  </Link>
                ))}
              </div>

              {c.strong.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl bg-success/[0.05] p-3">
                  <span className="text-xs font-medium text-success">أقوياء في المادة — يمكنهم دعم زملائهم (تدريس الأقران)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {c.strong.map((p) => (
                      <Link
                        key={p.id}
                        href={`/admin/academic/${p.id}`}
                        className="rounded-full bg-success/12 px-2.5 py-1 text-xs text-success transition-colors hover:bg-success/20"
                      >
                        {p.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <SubjectActions subjectId={c.id} subjectName={c.name} actions={c.actions} today={today} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
