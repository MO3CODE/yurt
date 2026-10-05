import Link from "next/link";
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GpaTrend } from "@/components/academic/gpa-trend";
import { gpaRatio } from "@/lib/academic";
import { REPORT_KINDS, formatGpa, type AcademicTerm } from "@/lib/grades";
import type { ReportRow } from "@/lib/grades-server";

/** كشوف درجات الطالب عبر الترمات (في ملفه بالمتابعة الأكاديمية) */
export function StudentGradeHistory({ terms, reports, urlBy }: { terms: AcademicTerm[]; reports: ReportRow[]; urlBy: Map<string | null, string | null> }) {
  const by = new Map(reports.map((r) => [`${r.term_id}:${r.kind}`, r]));
  const withReports = terms.filter((t) => REPORT_KINDS.some((k) => by.has(`${t.id}:${k}`)));
  const trend = [...withReports]
    .reverse()
    .map((t) => {
      const f = by.get(`${t.id}:final`);
      const g = f ? (f.verified_cumulative_gpa ?? f.cumulative_gpa) : null;
      return g === null ? null : { label: t.name, ratio: gpaRatio(g, 4) ?? 0, text: formatGpa(g) };
    })
    .filter((p): p is { label: string; ratio: number; text: string } => p !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>كشوف الدرجات</CardTitle>
        <CardDescription>
          {withReports.length ? "ما رفعه الطالب في كل ترم" : "لم يرفع الطالب كشوفاً بعد"} ·{" "}
          <Link href="/admin/academic/grades" className="underline-offset-2 hover:underline">
            كل الترمات
          </Link>
        </CardDescription>
      </CardHeader>
      {withReports.length > 0 && (
        <CardContent className="flex flex-col gap-4">
          {trend.length > 1 && <GpaTrend points={trend} />}
          <ul className="flex flex-col divide-y">
            {withReports.map((t) => (
              <li key={t.id} className="flex flex-col gap-1.5 py-2.5">
                <span className="text-sm font-medium">{t.name}</span>
                {REPORT_KINDS.map((k) => {
                  const r = by.get(`${t.id}:${k}`);
                  if (!r) return null;
                  return (
                    <div key={k} className="flex flex-wrap items-center gap-2 text-sm">
                      {r.status === "reviewed" ? <CheckCircle2 className="size-4 text-success" /> : <Clock className="size-4 text-warning" />}
                      <span className="text-muted-foreground">{k === "midterm" ? "النصفي" : "النهائي"}</span>
                      {k === "final" && (
                        <span className="tabular-nums">
                          {formatGpa(r.verified_term_gpa ?? r.term_gpa)} فصلي · {formatGpa(r.verified_cumulative_gpa ?? r.cumulative_gpa)} تراكمي
                        </span>
                      )}
                      {r.file_paths.map((p, i) => (
                        <a key={p} href={urlBy.get(p) ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
                          <FileText className="size-3.5" /> ملف {i + 1}
                        </a>
                      ))}
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
