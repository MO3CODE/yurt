import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, MessageCircle, Pencil, Plus, Trophy, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TermFormDialog } from "@/components/grades/term-form-dialog";
import { ReviewGradeDialog, type AdminReport } from "@/components/grades/review-grade-dialog";
import { RecomputeTermButton } from "@/components/grades/recompute-term-button";
import { TermImportDialog } from "@/components/grades/term-import-dialog";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { formatShortDateISO, todayISO } from "@/lib/date";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { GRADES_BUCKET, REPORT_KINDS, formatGpa, windowOf, windowState, type AcademicTerm, type ReportKind } from "@/lib/grades";
import type { ReportCourseRow, ReportRow } from "@/lib/grades-server";
import { draftFromCourse } from "@/lib/course-drafts";
import { getScholarshipConfig, pickScale } from "@/lib/scholarship-server";
import { FLAG_LABELS, STATUS_META, STATUS_ORDER, type StandingFlag, type StandingStatus } from "@/lib/scholarship";

export default async function AdminGradesPage({ searchParams }: PageProps<"/admin/academic/grades">) {
  await requirePermission("academic");
  const { term: termParam } = await searchParams;
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: termRows }, { data: students }] = await Promise.all([
    supabase.from("academic_terms").select("*").order("midterm_from", { ascending: false }),
    supabase.from("students").select("id, profiles!students_id_fkey(full_name, phone), apartment:apartment_id(name)").eq("status", "active"),
  ]);
  const terms = (termRows ?? []) as (AcademicTerm & { historical: boolean })[];
  const term = terms.find((t) => t.id === termParam) ?? terms[0];

  const rows = (students ?? [])
    .map((s) => {
      const profile = s.profiles as unknown as { full_name: string; phone: string | null } | null;
      return {
        id: s.id,
        name: profile?.full_name ?? "—",
        phone: profile?.phone ?? null,
        apartment: (s.apartment as unknown as { name: string } | null)?.name ?? "—",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const nameById = new Map(rows.map((r) => [r.id, r.name]));

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav className="flex flex-wrap gap-2" aria-label="الترمات">
        {terms.map((t) => (
          <Link
            key={t.id}
            href={`/admin/academic/grades?term=${t.id}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              t.id === term?.id ? "border-primary/40 bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.name}
            {t.historical && <span className="ms-1 text-[10px] opacity-70">(أرشيف)</span>}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap gap-2">
        <TermImportDialog students={rows.map((r) => ({ id: r.id, name: r.name }))} />
        <TermFormDialog
          trigger={
            <Button>
              <Plus /> ترم جديد
            </Button>
          }
        />
      </div>
    </div>
  );

  if (!term) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Empty>
          <EmptyMedia variant="icon">
            <FileSpreadsheet />
          </EmptyMedia>
          <EmptyTitle>لم تُفتح فترات رفع بعد</EmptyTitle>
          <EmptyDescription>
            أضف الترم الحالي بفترتي رفع النصفي والنهائي، فيصل للطلاب إشعار وتظهر لهم مهمة الرفع. ولنتائج سنة سابقة من تقرير استخدم «استيراد نتائج سنة سابقة».
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  const [{ data: reportRows }, { settings, scales }, { data: profiles }, { data: standingRows }, { data: awardRows }] = await Promise.all([
    supabase.from("grade_reports").select("*").eq("term_id", term.id),
    getScholarshipConfig(supabase),
    supabase.from("student_academic_profiles").select("student_id, grade_scale"),
    supabase
      .from("academic_standings")
      .select("student_id, term_gpa, cum_gpa, status, flags, courses_count, passed_count, failed_count, gpa_source")
      .eq("term_id", term.id),
    supabase.from("academic_awards").select("amount, status").eq("term_id", term.id),
  ]);
  const reports = (reportRows ?? []) as ReportRow[];
  const reportIds = reports.map((r) => r.id);
  const [{ data: signed }, { data: courseRows }] = await Promise.all([
    reports.length ? supabase.storage.from(GRADES_BUCKET).createSignedUrls(reports.flatMap((r) => r.file_paths), 3600) : Promise.resolve({ data: [] }),
    reportIds.length ? supabase.from("grade_report_courses").select("*").in("report_id", reportIds).order("sort_order") : Promise.resolve({ data: [] }),
  ]);
  const urlBy = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const reportBy = new Map(reports.map((r) => [`${r.student_id}:${r.kind}`, r]));
  const coursesBy = new Map<string, ReportCourseRow[]>();
  for (const c of (courseRows ?? []) as ReportCourseRow[]) coursesBy.set(c.report_id, [...(coursesBy.get(c.report_id) ?? []), c]);
  const scaleBy = new Map((profiles ?? []).map((p) => [p.student_id, p.grade_scale]));
  const standingBy = new Map((standingRows ?? []).map((s) => [s.student_id, s]));

  const toAdmin = (r: ReportRow): AdminReport => ({
    id: r.id,
    kind: r.kind as ReportKind,
    status: r.status as AdminReport["status"],
    termGpa: r.term_gpa,
    cumulativeGpa: r.cumulative_gpa,
    verifiedTermGpa: r.verified_term_gpa,
    verifiedCumulativeGpa: r.verified_cumulative_gpa,
    note: r.note,
    adminNote: r.admin_note,
    files: r.file_paths.map((p) => ({ url: urlBy.get(p) ?? "#", isPdf: p.endsWith(".pdf") })),
    courses: (coursesBy.get(r.id) ?? []).map(draftFromCourse),
  });

  const counts = REPORT_KINDS.map((kind) => {
    const ofKind = reports.filter((r) => r.kind === kind);
    return { kind, submitted: ofKind.length, pending: ofKind.filter((r) => r.status === "pending").length };
  });

  // مؤشرات الترم
  const activeStandings = (standingRows ?? []).filter((s) => nameById.has(s.student_id));
  const byStatus = new Map<StandingStatus, number>(STATUS_ORDER.map((st) => [st, activeStandings.filter((s) => s.status === st).length]));
  const avg = (vals: (number | null)[]) => {
    const xs = vals.filter((v): v is number => v !== null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const avgTerm = avg(activeStandings.map((s) => s.term_gpa));
  const avgCum = avg(activeStandings.map((s) => s.cum_gpa));
  const liveAwards = (awardRows ?? []).filter((a) => a.status !== "cancelled");
  const awardTotal = liveAwards.reduce((a, b) => a + Number(b.amount), 0);
  const finalState = windowState(term, "final", today);

  // يحتاج انتباهك
  const attention = [
    ...activeStandings
      .filter((s) => s.status === "warning" || s.status === "at_risk")
      .map((s) => ({ id: s.student_id, text: STATUS_META[s.status as StandingStatus].label, tone: "destructive" as const })),
    ...activeStandings.flatMap((s) =>
      (s.flags as StandingFlag[])
        .filter((f) => f === "sharp_drop" || f === "gpa_mismatch")
        .map((f) => ({ id: s.student_id, text: FLAG_LABELS[f], tone: "warning" as const }))
    ),
    ...(finalState === "closed" && !term.historical ? rows.filter((s) => !reportBy.has(`${s.id}:final`)).map((s) => ({ id: s.id, text: "لم يرفع النهائي", tone: "muted" as const })) : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {term.name}
            <TermFormDialog
              term={term}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="تعديل الترم">
                  <Pencil />
                </Button>
              }
            />
            <RecomputeTermButton termId={term.id} />
          </CardTitle>
          <CardDescription className="flex flex-col gap-0.5">
            {term.historical && <span>ترم أرشيفي — نتائجه مستوردة من تقرير ({arNum(activeStandings.length)} طالب)، فلا يُطلب فيه رفع كشف.</span>}
            {!term.historical && counts.map((c) => {
              const w = windowOf(term, c.kind);
              const state = windowState(term, c.kind, today);
              return (
                <span key={c.kind}>
                  {c.kind === "midterm" ? "النصفي" : "النهائي"}: {formatShortDateISO(w.from)} – {formatShortDateISO(w.to)} ·{" "}
                  {state === "upcoming" ? "لم تُفتح" : state === "open" ? "مفتوحة" : "انتهت"} · رفع {arNum(c.submitted)} من{" "}
                  {arNum(rows.length)}
                  {c.pending ? ` · ${arNum(c.pending)} بانتظار المراجعة` : ""}
                </span>
              );
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {activeStandings.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>
                  متوسط الفصلي: <span className="font-semibold tabular-nums">{formatGpa(avgTerm)}</span>
                </span>
                <span>
                  متوسط التراكمي: <span className="font-semibold tabular-nums">{formatGpa(avgCum)}</span>
                </span>
                <Link href={`/admin/academic/awards?term=${term.id}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Trophy className="size-4" /> {arNum(liveAwards.length)} متميز · {arNum(awardTotal)} {settings.awardCurrency}
                </Link>
              </div>
              {/* توزيع الطلاب على الحالات */}
              <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="توزيع الطلاب على حالات المنحة">
                {STATUS_ORDER.map((st) =>
                  byStatus.get(st) ? (
                    <div key={st} className={STATUS_META[st].dot} style={{ width: `${((byStatus.get(st) ?? 0) / activeStandings.length) * 100}%` }} />
                  ) : null
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.map((st) => (
                  <span key={st} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_META[st].className)}>
                    {STATUS_META[st].label}: {arNum(byStatus.get(st) ?? 0)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {attention.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-destructive/25 bg-destructive/[0.04] p-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <AlertTriangle className="size-4 text-destructive" /> يحتاج انتباهك
              </span>
              <div className="flex flex-wrap gap-1.5">
                {attention.map((a, i) => (
                  <Link
                    key={`${a.id}-${i}`}
                    href={`/admin/academic/${a.id}`}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs hover:opacity-80",
                      a.tone === "destructive" ? "bg-destructive/12 text-destructive" : a.tone === "warning" ? "bg-warning/20 text-warning-foreground dark:text-warning" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {nameById.get(a.id) ?? "—"} · {a.text}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {term.historical ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>المواد</TableHead>
                  <TableHead>الفصلي</TableHead>
                  <TableHead>التراكمي</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows
                  .filter((s) => standingBy.has(s.id))
                  .map((s) => {
                    const st = standingBy.get(s.id)!;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          <Link href={`/admin/academic/${s.id}`} className="hover:underline">
                            {s.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {st.courses_count !== null ? (
                            <>
                              {arNum(st.courses_count)}
                              {st.failed_count ? <span className="text-destructive"> · {arNum(st.failed_count)} راسب</span> : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">{formatGpa(st.term_gpa)}</TableCell>
                        <TableCell className="tabular-nums">
                          {formatGpa(st.cum_gpa)}
                          {st.gpa_source === "calculated" && <span className="block text-[10px] text-muted-foreground">تقدير</span>}
                        </TableCell>
                        <TableCell>
                          <span className="flex flex-col items-start gap-0.5">
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_META[st.status as StandingStatus].className)}>
                              {STATUS_META[st.status as StandingStatus].label}
                            </span>
                            {(st.flags as StandingFlag[]).length > 0 && (
                              <span className="text-[11px] text-muted-foreground">{(st.flags as StandingFlag[]).map((f) => FLAG_LABELS[f]).join(" · ")}</span>
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>الشقة</TableHead>
                  <TableHead>النصفي</TableHead>
                  <TableHead>النهائي</TableHead>
                  <TableHead>المعدل</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const final = reportBy.get(`${s.id}:final`);
                  const gpa = final ? (final.verified_cumulative_gpa ?? final.cumulative_gpa) : null;
                  const standing = standingBy.get(s.id);
                  const scale = pickScale(scales, scaleBy.get(s.id));
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/academic/${s.id}`} className="hover:underline">
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell>{s.apartment}</TableCell>
                      {REPORT_KINDS.map((kind) => {
                        const r = reportBy.get(`${s.id}:${kind}`);
                        const state = windowState(term, kind, today);
                        return (
                          <TableCell key={kind}>
                            {r ? (
                              <ReviewGradeDialog
                                studentName={s.name}
                                report={toAdmin(r)}
                                scale={scale}
                                settings={settings}
                                trigger={
                                  <Button variant="ghost" size="sm" className="h-auto px-2 py-1">
                                    {r.status === "reviewed" ? (
                                      <Badge className="bg-success/15 text-success">
                                        <CheckCircle2 /> رُوجع
                                      </Badge>
                                    ) : r.status === "returned" ? (
                                      <Badge variant="outline">
                                        <Undo2 /> أُعيد للطالب
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-warning/20 text-warning-foreground dark:text-warning">
                                        <Clock /> راجِع
                                      </Badge>
                                    )}
                                  </Button>
                                }
                              />
                            ) : state === "upcoming" ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Badge variant="outline">لم يرفع</Badge>
                                {s.phone && (
                                  <a
                                    href={buildWhatsAppLink(
                                      s.phone,
                                      `السلام عليكم ${s.name.split(" ")[0]}، نذكّرك برفع كشف درجات ${kind === "midterm" ? "النصفي" : "النهائي"} لـ${term.name} من صفحة «درجاتي» في منصة السكن. بالتوفيق!`
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-success hover:opacity-80"
                                    aria-label={`تذكير ${s.name} على واتساب`}
                                  >
                                    <MessageCircle className="size-4" />
                                  </a>
                                )}
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="tabular-nums">
                        {gpa !== null ? (
                          <span className={final?.status === "reviewed" ? "font-semibold" : "text-muted-foreground"}>{formatGpa(gpa)}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {standing ? (
                          <span className="flex flex-col items-start gap-0.5">
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_META[standing.status as StandingStatus].className)}>
                              {STATUS_META[standing.status as StandingStatus].label}
                            </span>
                            {(standing.flags as StandingFlag[]).length > 0 && (
                              <span className="text-[11px] text-muted-foreground">{(standing.flags as StandingFlag[]).map((f) => FLAG_LABELS[f]).join(" · ")}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
