import Link from "next/link";
import { CheckCircle2, Clock, FileSpreadsheet, MessageCircle, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TermFormDialog } from "@/components/grades/term-form-dialog";
import { ReviewGradeDialog, type AdminReport } from "@/components/grades/review-grade-dialog";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { formatShortDateISO, todayISO } from "@/lib/date";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { GRADES_BUCKET, REPORT_KINDS, formatGpa, windowOf, windowState, type AcademicTerm, type ReportKind } from "@/lib/grades";
import type { ReportRow } from "@/lib/grades-server";

export default async function AdminGradesPage({ searchParams }: PageProps<"/admin/academic/grades">) {
  await requirePermission("academic");
  const { term: termParam } = await searchParams;
  const supabase = await createClient();
  const today = todayISO();

  const { data: termRows } = await supabase.from("academic_terms").select("*").order("midterm_from", { ascending: false });
  const terms = (termRows ?? []) as AcademicTerm[];
  const term = terms.find((t) => t.id === termParam) ?? terms[0];

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
          </Link>
        ))}
      </nav>
      <TermFormDialog
        trigger={
          <Button>
            <Plus /> ترم جديد
          </Button>
        }
      />
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
          <EmptyDescription>أضف الترم الحالي بفترتي رفع النصفي والنهائي، فيصل للطلاب إشعار وتظهر لهم مهمة الرفع.</EmptyDescription>
        </Empty>
      </div>
    );
  }

  const [{ data: students }, { data: reportRows }] = await Promise.all([
    supabase.from("students").select("id, profiles!students_id_fkey(full_name, phone), apartment:apartment_id(name)").eq("status", "active"),
    supabase.from("grade_reports").select("*").eq("term_id", term.id),
  ]);
  const reports = (reportRows ?? []) as ReportRow[];
  const paths = reports.flatMap((r) => r.file_paths);
  const { data: signed } = paths.length ? await supabase.storage.from(GRADES_BUCKET).createSignedUrls(paths, 3600) : { data: [] };
  const urlBy = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const reportBy = new Map(reports.map((r) => [`${r.student_id}:${r.kind}`, r]));

  const toAdmin = (r: ReportRow): AdminReport => ({
    id: r.id,
    kind: r.kind as ReportKind,
    status: r.status as "pending" | "reviewed",
    termGpa: r.term_gpa,
    cumulativeGpa: r.cumulative_gpa,
    verifiedTermGpa: r.verified_term_gpa,
    verifiedCumulativeGpa: r.verified_cumulative_gpa,
    note: r.note,
    adminNote: r.admin_note,
    files: r.file_paths.map((p) => ({ url: urlBy.get(p) ?? "#", isPdf: p.endsWith(".pdf") })),
  });

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

  const counts = REPORT_KINDS.map((kind) => {
    const ofKind = reports.filter((r) => r.kind === kind);
    return { kind, submitted: ofKind.length, pending: ofKind.filter((r) => r.status === "pending").length };
  });

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
          </CardTitle>
          <CardDescription className="flex flex-col gap-0.5">
            {counts.map((c) => {
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>الشقة</TableHead>
                <TableHead>النصفي</TableHead>
                <TableHead>النهائي</TableHead>
                <TableHead>المعدل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const final = reportBy.get(`${s.id}:final`);
                const gpa = final ? (final.verified_cumulative_gpa ?? final.cumulative_gpa) : null;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
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
                              trigger={
                                <Button variant="ghost" size="sm" className="h-auto px-2 py-1">
                                  {r.status === "reviewed" ? (
                                    <Badge className="bg-success/15 text-success">
                                      <CheckCircle2 /> رُوجع
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
