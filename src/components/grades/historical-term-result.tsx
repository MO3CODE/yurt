import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { arNum } from "@/lib/quran";
import { formatGpa } from "@/lib/grades";
import { AWARD_STATUS_LABELS, STATUS_META, TIER_META, type AwardStatus, type AwardTier, type StandingStatus } from "@/lib/scholarship";

/** نتيجة ترم أرشيفي (مستوردة من تقرير الإدارة) كما يراها الطالب في «درجاتي» */
export function HistoricalTermResult({
  result,
  award,
}: {
  result: { status: string; term_gpa: number | null; cum_gpa: number | null; courses_count: number | null; failed_count: number | null } | null;
  award: { tier: AwardTier; amount: number; currency: string; status: AwardStatus } | null;
}) {
  if (!result) return <p className="text-sm text-muted-foreground">لا نتيجة مسجّلة لك في هذا الترم.</p>;
  const status = STATUS_META[result.status as StandingStatus];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span>
          المعدل الفصلي: <span className="font-semibold tabular-nums">{formatGpa(result.term_gpa)}</span>
        </span>
        <span>
          التراكمي: <span className="font-semibold tabular-nums">{formatGpa(result.cum_gpa)}</span>
        </span>
        {result.courses_count !== null && (
          <span>
            {arNum(result.courses_count)} مواد
            {result.failed_count ? <span className="text-destructive"> · {arNum(result.failed_count)} راسب</span> : " · نجح فيها كلها"}
          </span>
        )}
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", status.className)}>{status.label}</span>
      </div>
      {award && award.status !== "cancelled" && (
        <p className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/[0.08] p-2.5 text-sm">
          <Trophy className="mt-0.5 size-4 shrink-0 text-gold-foreground dark:text-gold" />
          <span>
            {TIER_META[award.tier].medal} جائزة التميز — الفئة {TIER_META[award.tier].label} ·{" "}
            <span className="font-semibold tabular-nums" dir="ltr">
              {award.amount} {award.currency}
            </span>{" "}
            ({AWARD_STATUS_LABELS[award.status]})
          </span>
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">من تقرير الإدارة الأكاديمي — تواصل معها إن وجدت خطأ.</p>
    </div>
  );
}
