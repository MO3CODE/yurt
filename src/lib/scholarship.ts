// متابعة طلاب المنحة — دوال نقية (تعمل في الواجهة والسيرفر، وتُختبر بلا قاعدة بيانات):
// نقاط كل مادة وتصنيفها، المعدل الفصلي المحسوب، حالة الطالب مع المنحة، أولوية الدعم، وفئة جائزة التميز.
// كل الحدود من الإعدادات (academic_settings) والقيم هنا هي الافتراضية.

// ---------------------------------------------------------------------
// الإعدادات
// ---------------------------------------------------------------------

export type AwardTier = "gold" | "silver" | "bronze";

export type ScholarshipSettings = {
  /** حدود الحالة على المعدل التراكمي */
  statusBands: { excellent: number; safe: number; watch: number };
  /** عدد الترمات المتتالية تحت حد «المراقبة» قبل الإحالة للإدارة */
  probationTerms: number;
  gpaMismatchTolerance: number;
  sharpDropThreshold: number;
  minTermCredits: number;
  /** المادة «متعثرة» تحت هذه النقاط، و«ضعيفة» تحت الثانية */
  strugglingBelow: number;
  weakBelow: number;
  /** نسبة النصفي التي تحتها تُعد المادة «متعثرة مبكراً» */
  midtermRiskPercent: number;
  groupTutoringMin: number;
  awardMode: "bands" | "rank";
  awardBasis: "term" | "cumulative";
  awardMinGpa: number;
  awardRequireNoFail: boolean;
  awardBands: { tier: AwardTier; min: number; amount: number }[];
  awardRankSlots: { tier: AwardTier; count: number; amount: number }[];
  awardCurrency: string;
};

export const DEFAULT_SETTINGS: ScholarshipSettings = {
  statusBands: { excellent: 2.7, safe: 2.5, watch: 2.0 },
  probationTerms: 2,
  gpaMismatchTolerance: 0.05,
  sharpDropThreshold: 0.3,
  minTermCredits: 12,
  strugglingBelow: 2.0,
  weakBelow: 2.3,
  midtermRiskPercent: 60,
  groupTutoringMin: 3,
  awardMode: "bands",
  awardBasis: "term",
  awardMinGpa: 2.7,
  awardRequireNoFail: true,
  awardBands: [
    { tier: "gold", min: 3.5, amount: 300 },
    { tier: "silver", min: 3.0, amount: 200 },
    { tier: "bronze", min: 2.7, amount: 150 },
  ],
  awardRankSlots: [
    { tier: "gold", count: 1, amount: 300 },
    { tier: "silver", count: 1, amount: 200 },
    { tier: "bronze", count: 1, amount: 150 },
  ],
  awardCurrency: "USD",
};

/** يدمج المحفوظ مع الافتراضي (المفاتيح الناقصة أو التالفة تأخذ الافتراضي) */
export function resolveSettings(saved: unknown): ScholarshipSettings {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<ScholarshipSettings>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const d = DEFAULT_SETTINGS;
  return {
    statusBands: {
      excellent: num(s.statusBands?.excellent, d.statusBands.excellent),
      safe: num(s.statusBands?.safe, d.statusBands.safe),
      watch: num(s.statusBands?.watch, d.statusBands.watch),
    },
    probationTerms: num(s.probationTerms, d.probationTerms),
    gpaMismatchTolerance: num(s.gpaMismatchTolerance, d.gpaMismatchTolerance),
    sharpDropThreshold: num(s.sharpDropThreshold, d.sharpDropThreshold),
    minTermCredits: num(s.minTermCredits, d.minTermCredits),
    strugglingBelow: num(s.strugglingBelow, d.strugglingBelow),
    weakBelow: num(s.weakBelow, d.weakBelow),
    midtermRiskPercent: num(s.midtermRiskPercent, d.midtermRiskPercent),
    groupTutoringMin: num(s.groupTutoringMin, d.groupTutoringMin),
    awardMode: s.awardMode === "rank" ? "rank" : "bands",
    awardBasis: s.awardBasis === "cumulative" ? "cumulative" : "term",
    awardMinGpa: num(s.awardMinGpa, d.awardMinGpa),
    awardRequireNoFail: typeof s.awardRequireNoFail === "boolean" ? s.awardRequireNoFail : d.awardRequireNoFail,
    awardBands: Array.isArray(s.awardBands) && s.awardBands.length ? s.awardBands : d.awardBands,
    awardRankSlots: Array.isArray(s.awardRankSlots) && s.awardRankSlots.length ? s.awardRankSlots : d.awardRankSlots,
    awardCurrency: typeof s.awardCurrency === "string" && s.awardCurrency ? s.awardCurrency : d.awardCurrency,
  };
}

// ---------------------------------------------------------------------
// سلالم الدرجات والمعدل
// ---------------------------------------------------------------------

export type ScaleItem = { letter: string; points: number | null };
export type GradeScale = { key: string; name: string; items: ScaleItem[] };

/** تقريب لمنزلتين (النصف لأعلى) دون أخطاء الفاصلة العائمة: 2.465 ← 2.47 */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const normalizeLetter = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");

export function findScaleItem(scale: GradeScale, letter: string | null | undefined): ScaleItem | null {
  if (!letter) return null;
  const key = normalizeLetter(letter);
  return scale.items.find((i) => normalizeLetter(i.letter) === key) ?? null;
}

export type RiskLevel = "fail" | "struggling" | "weak" | "early_risk" | "ok" | "excluded";

export type CourseInput = {
  name: string;
  credits: number;
  letter?: string | null;
  percent?: number | null;
  helpRequested?: boolean;
};

export type ClassifiedCourse<C extends CourseInput = CourseInput> = C & { points: number | null; risk: RiskLevel | null };

/** نقاط المادة وتصنيفها. القاعدة على النقاط لا الحرف، فتعمل مع أي سلّم */
export function classifyCourse<C extends CourseInput>(
  course: C,
  kind: "midterm" | "final",
  scale: GradeScale,
  s: ScholarshipSettings
): ClassifiedCourse<C> {
  if (kind === "midterm") {
    if (course.percent === null || course.percent === undefined) return { ...course, points: null, risk: null };
    return { ...course, points: null, risk: course.percent < s.midtermRiskPercent ? "early_risk" : "ok" };
  }
  const item = findScaleItem(scale, course.letter);
  if (!item) return { ...course, points: null, risk: null };
  if (item.points === null) return { ...course, points: null, risk: "excluded" };
  const p = item.points;
  const risk: RiskLevel = p === 0 ? "fail" : p < s.strugglingBelow ? "struggling" : p < s.weakBelow ? "weak" : "ok";
  return { ...course, points: p, risk };
}

/** المعدل الفصلي = مجموع (نقاط × ساعات) ÷ الساعات المحتسبة (الرموز المستبعدة لا تدخل) */
export function computeTermGpa(courses: { credits: number; points: number | null }[]): { gpa: number | null; credits: number } {
  const counted = courses.filter((c) => c.points !== null && c.credits > 0);
  const credits = counted.reduce((a, c) => a + c.credits, 0);
  if (credits === 0) return { gpa: null, credits: 0 };
  const total = counted.reduce((a, c) => a + (c.points as number) * c.credits, 0);
  return { gpa: round2(total / credits), credits: round2(credits) };
}

export const isMismatch = (calc: number | null, reported: number | null, s: ScholarshipSettings) =>
  calc !== null && reported !== null && round2(Math.abs(calc - reported)) > s.gpaMismatchTolerance;

// ---------------------------------------------------------------------
// حالة الطالب مع المنحة
// ---------------------------------------------------------------------

export type StandingStatus = "excellent" | "safe" | "watch" | "warning" | "at_risk";
export type StandingFlag = "sharp_drop" | "low_load" | "gpa_mismatch";

/**
 * belowWatchStreak: عدد الترمات المتتالية (مع هذا الترم) التي كان فيها التراكمي تحت حد المراقبة
 */
export function standingStatus(cumGpa: number, belowWatchStreak: number, s: ScholarshipSettings): StandingStatus {
  if (cumGpa >= s.statusBands.excellent) return "excellent";
  if (cumGpa >= s.statusBands.safe) return "safe";
  if (cumGpa >= s.statusBands.watch) return "watch";
  return belowWatchStreak >= s.probationTerms ? "at_risk" : "warning";
}

export type PriorStanding = { termGpa: number | null; cumGpa: number | null; credits: number };

export type FinalAnalysis<C extends CourseInput> = {
  courses: ClassifiedCourse<C>[];
  calcTermGpa: number | null;
  countedCredits: number;
  mismatch: boolean;
  termGpa: number | null;
  cumGpa: number | null;
  gpaSource: "official" | "calculated";
  status: StandingStatus | null;
  flags: StandingFlag[];
  hasFail: boolean;
};

/**
 * تحليل كشف النهائي.
 * previous: حالات الترمات السابقة المؤكَّدة، الأحدث أولاً.
 */
export function analyzeFinal<C extends CourseInput>(input: {
  courses: C[];
  reportedTermGpa: number | null;
  reportedCumGpa: number | null;
  previous: PriorStanding[];
  scale: GradeScale;
  settings: ScholarshipSettings;
}): FinalAnalysis<C> {
  const s = input.settings;
  const courses = input.courses.map((c) => classifyCourse(c, "final", input.scale, s));
  const { gpa: calc, credits } = computeTermGpa(courses);
  const termGpa = input.reportedTermGpa ?? calc;

  // التراكمي الرسمي من الكشف؛ وإلا يُحسب من الترمات السابقة مع هذا الترم
  let cumGpa = input.reportedCumGpa;
  let gpaSource: "official" | "calculated" = "official";
  if (cumGpa === null) {
    gpaSource = "calculated";
    const parts = [{ gpa: termGpa, credits }, ...input.previous.map((p) => ({ gpa: p.termGpa, credits: p.credits }))].filter(
      (p): p is { gpa: number; credits: number } => p.gpa !== null && p.credits > 0
    );
    const totalCredits = parts.reduce((a, p) => a + p.credits, 0);
    cumGpa = totalCredits ? round2(parts.reduce((a, p) => a + p.gpa * p.credits, 0) / totalCredits) : termGpa;
  }

  let status: StandingStatus | null = null;
  if (cumGpa !== null) {
    let streak = cumGpa < s.statusBands.watch ? 1 : 0;
    if (streak) {
      for (const p of input.previous) {
        if (p.cumGpa !== null && p.cumGpa < s.statusBands.watch) streak++;
        else break;
      }
    }
    status = standingStatus(cumGpa, streak, s);
  }

  const flags: StandingFlag[] = [];
  const prevTerm = input.previous[0]?.termGpa ?? null;
  if (prevTerm !== null && termGpa !== null && round2(prevTerm - termGpa) > s.sharpDropThreshold) flags.push("sharp_drop");
  if (credits < s.minTermCredits) flags.push("low_load");
  const mismatch = isMismatch(calc, input.reportedTermGpa, s);
  if (mismatch) flags.push("gpa_mismatch");

  return {
    courses,
    calcTermGpa: calc,
    countedCredits: credits,
    mismatch,
    termGpa,
    cumGpa,
    gpaSource,
    status,
    flags,
    hasFail: courses.some((c) => c.risk === "fail"),
  };
}

// ---------------------------------------------------------------------
// الدعم
// ---------------------------------------------------------------------

export type SupportPriority = "urgent" | "high" | "medium";
export const PRIORITY_RANK: Record<SupportPriority, number> = { urgent: 3, high: 2, medium: 1 };

/** هل تحتاج المادة طلب دعم، وبأي أولوية؟ (null = لا) */
export function supportPriority(
  course: { risk: RiskLevel | null; helpRequested?: boolean },
  status: StandingStatus | null
): SupportPriority | null {
  const r = course.risk;
  if (r === "fail") return "urgent";
  if (r === "struggling") return status === "warning" || status === "at_risk" ? "urgent" : "high";
  if (r === "early_risk") return "high";
  if (r === "weak" && status === "watch") return "medium";
  if (course.helpRequested) return "medium";
  return null;
}

// ---------------------------------------------------------------------
// جوائز التميز
// ---------------------------------------------------------------------

export type AwardCandidate = {
  studentId: string;
  termGpa: number | null;
  cumGpa: number | null;
  credits: number;
  hasFail: boolean;
};

export type AwardResult = { studentId: string; gpa: number; tier: AwardTier; amount: number };

export const awardGpa = (c: AwardCandidate, s: ScholarshipSettings) => (s.awardBasis === "cumulative" ? c.cumGpa : c.termGpa);

export function isAwardEligible(c: AwardCandidate, s: ScholarshipSettings): boolean {
  const gpa = awardGpa(c, s);
  if (gpa === null || gpa < s.awardMinGpa) return false;
  if (c.credits < s.minTermCredits) return false;
  if (s.awardRequireNoFail && c.hasFail) return false;
  return true;
}

/**
 * جوائز الترم كاملاً.
 * الفئات: كل مؤهل يأخذ فئة معدله. الترتيب: الأعلى معدلاً يأخذ المراكز بالترتيب،
 * والمتعادلون (نفس المعدل ونفس التراكمي) يأخذون الفئة نفسها.
 */
export function computeAwards(candidates: AwardCandidate[], s: ScholarshipSettings): AwardResult[] {
  const eligible = candidates.filter((c) => isAwardEligible(c, s));
  if (s.awardMode === "bands") {
    const bands = [...s.awardBands].sort((a, b) => b.min - a.min);
    return eligible.flatMap((c) => {
      const gpa = awardGpa(c, s) as number;
      const band = bands.find((b) => gpa >= b.min);
      return band ? [{ studentId: c.studentId, gpa, tier: band.tier, amount: band.amount }] : [];
    });
  }

  const sorted = [...eligible].sort(
    (a, b) => (awardGpa(b, s) as number) - (awardGpa(a, s) as number) || (b.cumGpa ?? 0) - (a.cumGpa ?? 0)
  );
  const slots = s.awardRankSlots.flatMap((slot) => Array.from({ length: Math.max(0, slot.count) }, () => slot));
  const out: AwardResult[] = [];
  let slotIndex = 0;
  sorted.forEach((c, i) => {
    const gpa = awardGpa(c, s) as number;
    const prev = sorted[i - 1];
    const tiedWithPrev = prev && awardGpa(prev, s) === gpa && prev.cumGpa === c.cumGpa && out.length > 0 && out[out.length - 1].studentId === prev.studentId;
    if (tiedWithPrev) {
      const last = out[out.length - 1];
      out.push({ studentId: c.studentId, gpa, tier: last.tier, amount: last.amount });
      slotIndex++;
      return;
    }
    const slot = slots[slotIndex];
    if (!slot) return;
    out.push({ studentId: c.studentId, gpa, tier: slot.tier, amount: slot.amount });
    slotIndex++;
  });
  return out;
}

// ---------------------------------------------------------------------
// نصوص وألوان
// ---------------------------------------------------------------------

export const STATUS_META: Record<StandingStatus, { label: string; hint: string; className: string; dot: string }> = {
  excellent: { label: "متميز", hint: "مؤهل لمسابقة التميز", className: "bg-success/20 text-success", dot: "bg-success" },
  safe: { label: "آمن", hint: "لا إجراء", className: "bg-success/10 text-success", dot: "bg-success/60" },
  watch: { label: "تحت المراقبة", hint: "متابعة شهرية وأولوية في الدعم", className: "bg-warning/20 text-warning-foreground dark:text-warning", dot: "bg-warning" },
  warning: { label: "إنذار", hint: "إنذار أول وخطة دعم إلزامية", className: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  at_risk: { label: "خطر فقدان المنحة", hint: "يُحال للإدارة لقرار بشأن المنحة", className: "bg-destructive text-white", dot: "bg-destructive" },
};
export const STATUS_ORDER: StandingStatus[] = ["excellent", "safe", "watch", "warning", "at_risk"];

export const FLAG_LABELS: Record<StandingFlag, string> = {
  sharp_drop: "هبوط حاد",
  low_load: "عبء دراسي ناقص",
  gpa_mismatch: "تعارض في المعدل",
};

export const RISK_META: Record<RiskLevel, { label: string; className: string }> = {
  fail: { label: "راسب", className: "bg-destructive text-white" },
  struggling: { label: "متعثر", className: "bg-destructive/12 text-destructive" },
  weak: { label: "ضعيف", className: "bg-warning/20 text-warning-foreground dark:text-warning" },
  early_risk: { label: "متعثر مبكراً", className: "bg-destructive/12 text-destructive" },
  ok: { label: "جيد", className: "bg-success/12 text-success" },
  excluded: { label: "لا يُحتسب", className: "bg-muted text-muted-foreground" },
};

export const PRIORITY_META: Record<SupportPriority, { label: string; className: string }> = {
  urgent: { label: "عاجلة", className: "bg-destructive text-white" },
  high: { label: "عالية", className: "bg-destructive/12 text-destructive" },
  medium: { label: "متوسطة", className: "bg-warning/20 text-warning-foreground dark:text-warning" },
};

/** حالات طلب الدعم (support_status) بمعانيها في متابعة المنحة */
export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  open: "مقترح / بانتظار",
  assigned: "مُسند لمدرّس",
  in_progress: "جارٍ",
  resolved: "مكتمل",
  closed: "مرفوض / ملغى",
};

export const TIER_META: Record<AwardTier, { label: string; medal: string; className: string }> = {
  gold: { label: "الذهبية", medal: "🥇", className: "bg-gold/20 text-gold-foreground dark:text-gold" },
  silver: { label: "الفضية", medal: "🥈", className: "bg-muted text-foreground" },
  bronze: { label: "البرونزية", medal: "🥉", className: "bg-warning/15 text-warning-foreground dark:text-warning" },
};

export type AwardStatus = "eligible" | "approved" | "paid" | "cancelled";
export const AWARD_STATUS_LABELS: Record<AwardStatus, string> = {
  eligible: "مستحقة",
  approved: "معتمدة",
  paid: "مصروفة",
  cancelled: "ملغاة",
};
