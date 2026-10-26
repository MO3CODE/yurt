import { FileSpreadsheet, Snowflake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { GradeUploadCard, type AwardView, type GradeReportView, type StandingView } from "@/components/grades/grade-upload-card";
import { draftFromCourse, emptyCourse } from "@/lib/course-drafts";
import { TermCoursesEditor, type TermCourse } from "@/components/grades/term-courses-editor";
import { HistoricalTermResult } from "@/components/grades/historical-term-result";
import { LanguageProgressCard } from "@/components/academic/language-progress-card";
import { todayISO } from "@/lib/date";
import { REPORT_KINDS, formatGpa, windowOf, windowState } from "@/lib/grades";
import { getStudentGrades } from "@/lib/grades-server";
import { getStudentScholarshipContext } from "@/lib/scholarship-server";
import type { AwardStatus, AwardTier, StandingFlag, StandingStatus } from "@/lib/scholarship";

export default async function GradesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = todayISO();
  const [{ terms, reports, urlBy, coursesByReport }, { scale, settings }, { data: standings }, { data: awards }] = await Promise.all([
    getStudentGrades(supabase, user.id),
    getStudentScholarshipContext(user.id),
    supabase.from("academic_standings").select("term_id, status, flags, term_gpa, cum_gpa, courses_count, failed_count").eq("student_id", user.id),
    supabase.from("academic_awards").select("term_id, tier, amount, currency, status").eq("student_id", user.id),
  ]);
  const [{ data: language }, { data: termCourses }, { data: freezes }] = await Promise.all([
    supabase.from("student_language_progress").select("*").eq("student_id", user.id).maybeSingle(),
    supabase.from("student_term_courses").select("id, term_id, course_name, course_code, instructor").eq("student_id", user.id).order("created_at"),
    supabase.from("student_term_freezes").select("term_id, reason").eq("student_id", user.id),
  ]);
  const freezeBy = new Map((freezes ?? []).map((f) => [f.term_id, f]));
  const termCoursesBy = new Map<string, TermCourse[]>();
  for (const c of termCourses ?? []) termCoursesBy.set(c.term_id, [...(termCoursesBy.get(c.term_id) ?? []), c]);
  const standingBy = new Map((standings ?? []).map((s) => [s.term_id, { status: s.status as StandingStatus, flags: s.flags as StandingFlag[] }]));
  const resultBy = new Map((standings ?? []).map((s) => [s.term_id, s]));
  const awardBy = new Map(
    (awards ?? []).map((a) => [a.term_id, { tier: a.tier as AwardTier, amount: Number(a.amount), currency: a.currency, status: a.status as AwardStatus }])
  );
  // أسماء المواد السابقة للاقتراح التلقائي
  const suggestions = [...new Set([...[...coursesByReport.values()].flat(), ...(termCourses ?? [])].map((c) => c.course_name))].sort((a, b) =>
    a.localeCompare(b, "ar")
  );

  const reportBy = new Map(reports.map((r) => [`${r.term_id}:${r.kind}`, r]));
  const view = (termId: string, kind: string): GradeReportView | null => {
    const r = reportBy.get(`${termId}:${kind}`);
    if (!r) return null;
    return {
      status: r.status as GradeReportView["status"],
      termGpa: r.term_gpa,
      cumulativeGpa: r.cumulative_gpa,
      verifiedTermGpa: r.verified_term_gpa,
      verifiedCumulativeGpa: r.verified_cumulative_gpa,
      note: r.note,
      adminNote: r.admin_note,
      submittedAt: r.created_at,
      paths: r.file_paths,
      files: r.file_paths.map((p) => ({ url: urlBy.get(p) ?? "#", isPdf: p.endsWith(".pdf") })),
      courses: (coursesByReport.get(r.id) ?? []).map(draftFromCourse),
    };
  };

  // تطور المعدل التراكمي عبر الترمات (من كشوف النهائي)
  const trend = [...terms]
    .reverse()
    .map((t) => {
      const r = reportBy.get(`${t.id}:final`);
      const gpa = r ? (r.verified_cumulative_gpa ?? r.cumulative_gpa) : null;
      return { name: t.name, gpa, verified: r?.status === "reviewed" };
    })
    .filter((x) => x.gpa !== null);

  return (
    <div className="stagger flex flex-col gap-6">
      <PageHeader title="درجاتي" description="اكتب موادك ودرجاتك في كل ترم (النصفي والنهائي) وارفع كشف الجامعة، لتتابع معك الإدارة وتعرف حالتك مع المنحة" />

      {language && <LanguageProgressCard progress={language} />}

      {trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>تطور معدلك التراكمي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-3" role="img" aria-label="المعدل التراكمي عبر الترمات">
              {trend.map((t) => (
                <div key={t.name} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs font-semibold tabular-nums">{formatGpa(t.gpa)}</span>
                  <div
                    className={t.verified ? "w-full max-w-12 rounded-t-md bg-primary" : "w-full max-w-12 rounded-t-md bg-primary/40"}
                    style={{ height: `${Math.max(6, ((t.gpa ?? 0) / 4) * 100)}%` }}
                  />
                  <span className="line-clamp-2 text-center text-[10px] text-muted-foreground">{t.name}</span>
                </div>
              ))}
            </div>
            <p className="pt-2 text-[11px] text-muted-foreground">العمود الباهت: لم تؤكّده الإدارة بعد</p>
          </CardContent>
        </Card>
      )}

      {terms.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <FileSpreadsheet />
          </EmptyMedia>
          <EmptyTitle>لم تُفتح فترة رفع بعد</EmptyTitle>
          <EmptyDescription>ستُعلن الإدارة عن فترة رفع درجات كل ترم، ويصلك إشعار.</EmptyDescription>
        </Empty>
      ) : (
        terms.map((term) => (
          <Card key={term.id}>
            <CardHeader>
              <CardTitle>{term.name}</CardTitle>
            </CardHeader>
            {term.historical ? (
              <CardContent>
                <HistoricalTermResult result={resultBy.get(term.id) ?? null} award={awardBy.get(term.id) ?? null} />
              </CardContent>
            ) : freezeBy.has(term.id) ? (
              <CardContent>
                <p className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.05] p-3 text-sm">
                  <Snowflake className="size-4 shrink-0 text-primary" />
                  <span>
                    جمّدت هذا الترم، فلا يُطلب منك فيه رفع كشف ولا تسجيل مواد.
                    {freezeBy.get(term.id)?.reason && <span className="text-muted-foreground"> ({freezeBy.get(term.id)?.reason})</span>}
                  </span>
                </p>
              </CardContent>
            ) : (
            <CardContent className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">موادي هذا الترم</h3>
              <p className="text-xs text-muted-foreground">سجّل كل موادك وأساتذتها، لتعرف الإدارة المواد المشتركة بينك وبين زملائك وتنظّم التقوية مبكراً.</p>
              <TermCoursesEditor termId={term.id} courses={termCoursesBy.get(term.id) ?? []} suggestions={suggestions} />
            </section>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
              {REPORT_KINDS.map((kind) => (
                <GradeUploadCard
                  key={kind}
                  termId={term.id}
                  kind={kind}
                  userId={user.id}
                  window={windowOf(term, kind)}
                  state={windowState(term, kind, today)}
                  report={view(term.id, kind)}
                  scale={scale}
                  settings={settings}
                  suggestions={suggestions}
                  standing={(kind === "final" ? standingBy.get(term.id) : null) ?? (null as StandingView)}
                  award={(kind === "final" ? awardBy.get(term.id) : null) ?? (null as AwardView)}
                  prefill={(termCoursesBy.get(term.id) ?? []).map((c) => ({ ...emptyCourse(), name: c.course_name, code: c.course_code ?? "" }))}
                />
              ))}
            </div>
            </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
