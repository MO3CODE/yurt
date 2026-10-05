import { FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { GradeUploadCard, type GradeReportView } from "@/components/grades/grade-upload-card";
import { todayISO } from "@/lib/date";
import { REPORT_KINDS, formatGpa, windowOf, windowState } from "@/lib/grades";
import { getStudentGrades } from "@/lib/grades-server";

export default async function GradesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const today = todayISO();
  const { terms, reports, urlBy } = await getStudentGrades(supabase, user.id);

  const reportBy = new Map(reports.map((r) => [`${r.term_id}:${r.kind}`, r]));
  const view = (termId: string, kind: string): GradeReportView | null => {
    const r = reportBy.get(`${termId}:${kind}`);
    if (!r) return null;
    return {
      status: r.status as "pending" | "reviewed",
      termGpa: r.term_gpa,
      cumulativeGpa: r.cumulative_gpa,
      verifiedTermGpa: r.verified_term_gpa,
      verifiedCumulativeGpa: r.verified_cumulative_gpa,
      note: r.note,
      adminNote: r.admin_note,
      submittedAt: r.created_at,
      files: r.file_paths.map((p) => ({ url: urlBy.get(p) ?? "#", isPdf: p.endsWith(".pdf") })),
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
      <PageHeader title="درجاتي" description="ارفع كشف درجاتك في كل ترم (النصفي والنهائي) ومعدلك، لتتابع معك الإدارة" />

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
            <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
              {REPORT_KINDS.map((kind) => (
                <GradeUploadCard
                  key={kind}
                  termId={term.id}
                  kind={kind}
                  userId={user.id}
                  window={windowOf(term, kind)}
                  state={windowState(term, kind, today)}
                  report={view(term.id, kind)}
                />
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
