import Link from "next/link";
import { AlertTriangle, Languages } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { LanguageImportDialog, LanguageProgressDialog } from "@/components/academic/language-board";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { daysBetweenISO, formatShortDateISO, todayISO } from "@/lib/date";
import { LANGUAGE_STATUS_META, LANGUAGE_STATUS_ORDER, type LanguageStatus } from "@/lib/scholarship";

export default async function LanguagePage() {
  await requirePermission("academic");
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: rows }, { data: students }] = await Promise.all([
    supabase.from("student_language_progress").select("*"),
    supabase.from("students").select("id, profiles!students_id_fkey(full_name)").eq("status", "active"),
  ]);
  const options = (students ?? [])
    .map((s) => ({ id: s.id, name: (s.profiles as unknown as { full_name: string } | null)?.full_name ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const nameOf = new Map(options.map((s) => [s.id, s.name]));

  const list = (rows ?? [])
    .map((r) => ({
      studentId: r.student_id,
      studentName: nameOf.get(r.student_id) ?? "—",
      levelsPassed: r.levels_passed,
      currentLevel: r.current_level,
      status: r.status as LanguageStatus,
      nextExamAt: r.next_exam_at,
      notes: r.notes,
    }))
    .sort((a, b) => LANGUAGE_STATUS_ORDER.indexOf(a.status) - LANGUAGE_STATUS_ORDER.indexOf(b.status) || a.studentName.localeCompare(b.studentName, "ar"));
  const tracked = new Set(list.map((l) => l.studentId));
  const urgent = list.filter((l) => l.status === "last_chance");
  // موعد امتحان مضى ولم تُحدَّث الحالة
  const stale = list.filter((l) => l.nextExamAt && l.nextExamAt < today && l.status !== "completed");

  const actions = (
    <div className="flex flex-wrap gap-2">
      <LanguageImportDialog students={options} />
      <LanguageProgressDialog students={options.filter((s) => !tracked.has(s.id))} />
    </div>
  );

  if (list.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {actions}
        <Empty>
          <EmptyMedia variant="icon">
            <Languages />
          </EmptyMedia>
          <EmptyTitle>لا طلاب لغة بعد</EmptyTitle>
          <EmptyDescription>استورد جدول طلاب اللغة من التقرير، أو أضف كل طالب بمستوياته.</EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_STATUS_ORDER.map((s) => {
            const n = list.filter((l) => l.status === s).length;
            return n ? (
              <span key={s} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", LANGUAGE_STATUS_META[s].className)}>
                {LANGUAGE_STATUS_META[s].label}: {arNum(n)}
              </span>
            ) : null;
          })}
        </div>
        {actions}
      </div>

      {(urgent.length > 0 || stale.length > 0) && (
        <section className="flex flex-col gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/[0.05] p-4 text-sm">
          <span className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-4 text-destructive" /> يحتاج انتباهك
          </span>
          {urgent.map((l) => (
            <span key={l.studentId}>
              <Link href={`/admin/academic/${l.studentId}`} className="font-medium hover:underline">
                {l.studentName}
              </Link>
              : فرصة أخيرة قبل خسارة المنحة{l.nextExamAt ? ` — الامتحان ${formatShortDateISO(l.nextExamAt)}` : " — حدّد موعد امتحانه"}
            </span>
          ))}
          {stale.map((l) => (
            <span key={`s-${l.studentId}`} className="text-muted-foreground">
              {l.studentName}: مضى موعد امتحانه ({formatShortDateISO(l.nextExamAt as string)}) — حدّث نتيجته
            </span>
          ))}
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((l) => {
          const days = l.nextExamAt ? daysBetweenISO(today, l.nextExamAt) : null;
          return (
            <article key={l.studentId} className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <Link href={`/admin/academic/${l.studentId}`} className="font-semibold hover:underline">
                    {l.studentName}
                  </Link>
                  <span className={cn("w-fit rounded-full px-2 py-0.5 text-xs font-medium", LANGUAGE_STATUS_META[l.status].className)}>
                    {LANGUAGE_STATUS_META[l.status].label}
                  </span>
                </div>
                <LanguageProgressDialog students={options} progress={l} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs" dir="ltr">
                {l.levelsPassed.map((lv) => (
                  <span key={lv} className="rounded-full bg-success/12 px-2 py-0.5 text-success">
                    {lv} ✓
                  </span>
                ))}
                {l.currentLevel && <span className="rounded-full border border-primary/40 px-2 py-0.5 font-semibold text-primary">{l.currentLevel}</span>}
              </div>
              {l.nextExamAt && (
                <span className={cn("text-xs", days !== null && days < 0 ? "text-destructive" : "text-muted-foreground")}>
                  الامتحان: {formatShortDateISO(l.nextExamAt)}
                  {days !== null && (days < 0 ? " (مضى)" : days === 0 ? " (اليوم)" : ` (بعد ${arNum(days)} يوم)`)}
                </span>
              )}
              {l.notes && <p className="text-sm leading-relaxed text-muted-foreground">{l.notes}</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
