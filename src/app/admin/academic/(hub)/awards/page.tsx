import Link from "next/link";
import { Banknote, Medal, Trophy, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApproveAllAwardsButton, AwardRowActions, AwardsExportButton } from "@/components/academic/award-row-actions";
import { RecomputeTermButton } from "@/components/grades/recompute-term-button";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { formatShortDateISO, todayISO } from "@/lib/date";
import { formatGpa, type AcademicTerm } from "@/lib/grades";
import { getScholarshipConfig } from "@/lib/scholarship-server";
import { AWARD_STATUS_LABELS, TIER_META, awardGpa, isAwardEligible, type AwardStatus, type AwardTier } from "@/lib/scholarship";

export default async function AwardsPage({ searchParams }: PageProps<"/admin/academic/awards">) {
  await requirePermission("academic");
  const { term: termParam } = await searchParams;
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: termRows }, { settings }] = await Promise.all([
    supabase.from("academic_terms").select("*").order("midterm_from", { ascending: false }),
    getScholarshipConfig(supabase),
  ]);
  const terms = (termRows ?? []) as AcademicTerm[];
  const term = terms.find((t) => t.id === termParam) ?? terms[0];

  if (!term) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Trophy />
        </EmptyMedia>
        <EmptyTitle>لا ترمات بعد</EmptyTitle>
        <EmptyDescription>
          افتح ترماً من{" "}
          <Link href="/admin/academic/grades" className="underline underline-offset-4">
            كشوف الدرجات
          </Link>
          ، وعند تأكيد كشوف النهائي يُحسب المتميزون وجوائزهم تلقائياً.
        </EmptyDescription>
      </Empty>
    );
  }

  const [{ data: awardRows }, { data: standingRows }, { data: students }] = await Promise.all([
    supabase.from("academic_awards").select("*").eq("term_id", term.id),
    supabase.from("academic_standings").select("student_id, term_gpa, cum_gpa, term_credits, has_fail").eq("term_id", term.id),
    supabase.from("students").select("id, university_name, profiles!students_id_fkey(full_name)"),
  ]);
  const studentBy = new Map(
    (students ?? []).map((s) => [s.id, { name: (s.profiles as unknown as { full_name: string } | null)?.full_name ?? "—", university: s.university_name }])
  );

  const awards = (awardRows ?? [])
    .map((a) => ({ ...a, amount: Number(a.amount), name: studentBy.get(a.student_id)?.name ?? "—" }))
    .sort((a, b) => Number(b.gpa_used) - Number(a.gpa_used) || a.name.localeCompare(b.name, "ar"));
  const live = awards.filter((a) => a.status !== "cancelled");
  const sum = (xs: { amount: number }[]) => xs.reduce((a, b) => a + b.amount, 0);
  const paid = live.filter((a) => a.status === "paid");
  const eligibleCount = live.filter((a) => a.status === "eligible").length;
  const currency = settings.awardCurrency;

  // قريب من التأهل: معدله تحت الحد بقليل، أو معدله يؤهله لكن منعه شرط آخر
  const awarded = new Set(awards.map((a) => a.student_id));
  const near = (standingRows ?? [])
    .filter((s) => !awarded.has(s.student_id) && studentBy.has(s.student_id))
    .map((s) => {
      const c = { studentId: s.student_id, termGpa: s.term_gpa, cumGpa: s.cum_gpa, credits: Number(s.term_credits), hasFail: s.has_fail };
      const gpa = awardGpa(c, settings);
      if (gpa === null) return null;
      if (gpa >= settings.awardMinGpa && !isAwardEligible(c, settings)) {
        const why = s.has_fail && settings.awardRequireNoFail ? "عنده مادة راسبة" : c.credits < settings.minTermCredits ? "ساعاته أقل من الحد" : "لم يأخذ مركزاً";
        return { id: s.student_id, gpa, why };
      }
      if (gpa < settings.awardMinGpa && gpa >= settings.statusBands.safe) return { id: s.student_id, gpa, why: `ينقصه ${formatGpa(settings.awardMinGpa - gpa)}` };
      return null;
    })
    .filter((x) => x !== null)
    .sort((a, b) => b.gpa - a.gpa);

  const exportRows = [
    ["الاسم", "الجامعة", "المعدل", "الفئة", "المبلغ", "العملة", "الحالة", "تاريخ الصرف", "مرجع الدفع"],
    ...live.map((a) => [
      a.name,
      studentBy.get(a.student_id)?.university ?? "",
      Number(a.gpa_used).toFixed(2),
      TIER_META[a.tier as AwardTier].label,
      String(a.amount),
      a.currency,
      AWARD_STATUS_LABELS[a.status as AwardStatus],
      a.paid_at ?? "",
      a.payment_ref ?? "",
    ]),
    ["الإجمالي", "", "", "", String(sum(live)), currency, "", "", ""],
  ];

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2" aria-label="الترمات">
        {terms.map((t) => (
          <Link
            key={t.id}
            href={`/admin/academic/awards?term=${t.id}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              t.id === term.id ? "border-primary/40 bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.name}
          </Link>
        ))}
      </nav>

      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="المتميزون" value={live.length} icon={Medal} tone="gold" />
        <StatCard label={`الميزانية المطلوبة (${currency})`} value={sum(live)} icon={Wallet} />
        <StatCard label={`المصروف (${currency})`} value={sum(paid)} icon={Banknote} tone="success" />
        <StatCard label={`المتبقي (${currency})`} value={sum(live) - sum(paid)} icon={Trophy} tone="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            مسابقة التميز — {term.name}
            <RecomputeTermButton termId={term.id} />
          </CardTitle>
          <CardDescription>
            {settings.awardMode === "bands" ? "بالفئات" : "بالترتيب"} على المعدل {settings.awardBasis === "term" ? "الفصلي" : "التراكمي"} · الحد الأدنى{" "}
            {formatGpa(settings.awardMinGpa)} و{arNum(settings.minTermCredits)} ساعة{settings.awardRequireNoFail ? " وبلا مادة راسبة" : ""} ·{" "}
            <Link href="/admin/academic/settings" className="underline-offset-2 hover:underline">
              تعديل الشروط
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <ApproveAllAwardsButton termId={term.id} count={eligibleCount} />
            <AwardsExportButton fileName={`جوائز التميز - ${term.name}.xlsx`} rows={exportRows} />
          </div>

          {awards.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا متميزين بعد — يُحسبون تلقائياً عند تأكيد كشوف النهائي.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>المعدل</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {awards.map((a) => {
                  const tier = TIER_META[a.tier as AwardTier];
                  const status = a.status as AwardStatus;
                  return (
                    <TableRow key={a.id} className={status === "cancelled" ? "opacity-50" : undefined}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/academic/${a.student_id}`} className="hover:underline">
                          {a.name}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatGpa(Number(a.gpa_used))}</TableCell>
                      <TableCell>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tier.className)}>
                          {tier.medal} {tier.label}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums" dir="ltr">
                        {a.amount} {a.currency}
                      </TableCell>
                      <TableCell className="text-sm">
                        {AWARD_STATUS_LABELS[status]}
                        {status === "paid" && a.paid_at && <span className="block text-[11px] text-muted-foreground">{formatShortDateISO(a.paid_at)} · {a.payment_method}</span>}
                      </TableCell>
                      <TableCell>
                        <AwardRowActions id={a.id} termId={term.id} status={status} studentName={a.name} today={today} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {near.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>قريبون من التأهل</CardTitle>
            <CardDescription>للتحفيز في الترم القادم</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {near.map((n) => (
              <Link key={n.id} href={`/admin/academic/${n.id}`} className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70">
                {studentBy.get(n.id)?.name} · <span className="tabular-nums">{formatGpa(n.gpa)}</span> · {n.why}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
