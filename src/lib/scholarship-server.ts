import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectKey } from "@/lib/academic";
import {
  PRIORITY_RANK,
  analyzeFinal,
  classifyCourse,
  computeAwards,
  resolveSettings,
  supportPriority,
  type FinalAnalysis,
  type GradeScale,
  type ScaleItem,
  type ScholarshipSettings,
  type StandingStatus,
  type SupportPriority,
} from "@/lib/scholarship";

// تطبيق تحليل الكشف عند تأكيده: تصنيف المواد، حالة الترم، طلبات الدعم، مواد الطالب، وجوائز الترم.
// كل خطوة تعيد الحساب ولا تكرر السجلات، فتأكيد الكشف مرة ثانية آمن.

type Db = Awaited<ReturnType<typeof createClient>>;

export const DEFAULT_SCALE_KEY = "yok";

export async function getScholarshipConfig(db: Db) {
  const [{ data: row }, { data: scaleRows }] = await Promise.all([
    db.from("academic_settings").select("value").maybeSingle(),
    db.from("academic_grade_scales").select("key, name, items").order("sort_order"),
  ]);
  const scales: GradeScale[] = (scaleRows ?? []).map((s) => ({ key: s.key, name: s.name, items: s.items as ScaleItem[] }));
  return { settings: resolveSettings(row?.value), scales };
}

export const pickScale = (scales: GradeScale[], key: string | null | undefined) =>
  scales.find((s) => s.key === key) ?? scales.find((s) => s.key === DEFAULT_SCALE_KEY) ?? scales[0];

/** سلّم الطالب ومعه الإعدادات — الطالب لا يقرأ ملفه الأكاديمي ولا الإعدادات، فتُقرأ عبر السيرفر */
export async function getStudentScholarshipContext(studentId: string) {
  const admin = createAdminClient();
  const [{ settings, scales }, { data: profile }] = await Promise.all([
    getScholarshipConfig(admin as unknown as Db),
    admin.from("student_academic_profiles").select("grade_scale").eq("student_id", studentId).maybeSingle(),
  ]);
  return { settings, scale: pickScale(scales, profile?.grade_scale) };
}

type CourseRow = { id: string; course_name: string; credits: number; letter: string | null; percent: number | null; help_requested: boolean };

export type AnalysisSummary = { kind: "midterm" | "final"; status: StandingStatus | null; supportCount: number; newAwardStudentIds: string[] };

export async function applyReportAnalysis(db: Db, reportId: string): Promise<AnalysisSummary> {
  const { data: report, error } = await db
    .from("grade_reports")
    .select("id, student_id, term_id, kind, term_gpa, cumulative_gpa, verified_term_gpa, verified_cumulative_gpa")
    .eq("id", reportId)
    .single();
  if (error || !report) throw new Error("الكشف غير موجود");

  const [{ settings, scales }, { data: profile }, { data: courseRows }] = await Promise.all([
    getScholarshipConfig(db),
    db.from("student_academic_profiles").select("grade_scale").eq("student_id", report.student_id).maybeSingle(),
    db.from("grade_report_courses").select("id, course_name, credits, letter, percent, help_requested").eq("report_id", reportId).order("sort_order"),
  ]);
  const scale = pickScale(scales, profile?.grade_scale);
  if (!scale) throw new Error("لا يوجد سلّم درجات");
  const courses = (courseRows ?? []) as CourseRow[];
  const toInput = (c: CourseRow) => ({ ...c, name: c.course_name, helpRequested: c.help_requested });

  if (report.kind === "midterm") {
    const classified = courses.map((c) => classifyCourse(toInput(c), "midterm", scale, settings));
    await saveCourseResults(db, classified.map((c) => ({ id: c.id, points: null, risk: c.risk })));
    let supportCount = 0;
    for (const c of classified) {
      const priority = supportPriority(c, null);
      if (!priority) continue;
      supportCount++;
      await upsertSupportRequest(db, {
        studentId: report.student_id,
        termId: report.term_id,
        courseId: c.id,
        name: c.course_name,
        priority,
        source: requestSource(c.risk),
        baselinePercent: c.percent,
        baselinePoints: null,
      });
    }
    await syncStudentSubjects(db, report.student_id, classified.map((c) => ({ name: c.course_name, risk: c.risk, points: null, percent: c.percent })));
    return { kind: "midterm", status: null, supportCount, newAwardStudentIds: [] };
  }

  const previous = await previousStandings(db, report.student_id, report.term_id);
  const analysis: FinalAnalysis<ReturnType<typeof toInput>> = analyzeFinal({
    courses: courses.map(toInput),
    reportedTermGpa: report.verified_term_gpa ?? report.term_gpa,
    reportedCumGpa: report.verified_cumulative_gpa ?? report.cumulative_gpa,
    previous,
    scale,
    settings,
  });

  await saveCourseResults(db, analysis.courses.map((c) => ({ id: c.id, points: c.points, risk: c.risk })));

  if (analysis.status) {
    const { error: e } = await db.from("academic_standings").upsert(
      {
        student_id: report.student_id,
        term_id: report.term_id,
        report_id: report.id,
        term_gpa: analysis.termGpa,
        cum_gpa: analysis.cumGpa,
        calc_term_gpa: analysis.calcTermGpa,
        term_credits: analysis.countedCredits,
        has_fail: analysis.hasFail,
        gpa_source: analysis.gpaSource,
        status: analysis.status,
        flags: analysis.flags,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "student_id,term_id" }
    );
    if (e) throw new Error(e.message);
  }

  // أثر الدعم: درجة النهائي في المواد المدعومة سابقاً (من النصفي أو بلا ترم)
  await recordSupportOutcomes(db, report.student_id, report.term_id, analysis.courses);

  let supportCount = 0;
  for (const c of analysis.courses) {
    const priority = supportPriority(c, analysis.status);
    if (!priority) continue;
    supportCount++;
    await upsertSupportRequest(db, {
      studentId: report.student_id,
      termId: report.term_id,
      courseId: c.id,
      name: c.course_name,
      priority,
      source: requestSource(c.risk),
      baselinePoints: c.points,
      baselinePercent: null,
    });
  }

  await syncStudentSubjects(db, report.student_id, analysis.courses.map((c) => ({ name: c.course_name, risk: c.risk, points: c.points, percent: null })));
  const newAwardStudentIds = await recomputeTermAwards(db, report.term_id, settings);
  return { kind: "final", status: analysis.status, supportCount, newAwardStudentIds };
}

/** إعادة حساب ترم كامل (بعد تغيير الإعدادات): كل كشوفه المؤكَّدة ثم الجوائز */
export async function recomputeTerm(db: Db, termId: string) {
  const { data: reports } = await db.from("grade_reports").select("id, kind").eq("term_id", termId).eq("status", "reviewed");
  const ordered = [...(reports ?? [])].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "midterm" ? -1 : 1));
  for (const r of ordered) await applyReportAnalysis(db, r.id);
  const { settings } = await getScholarshipConfig(db);
  await recomputeTermAwards(db, termId, settings);
  return ordered.length;
}

// ---------------------------------------------------------------------

async function saveCourseResults(db: Db, rows: { id: string; points: number | null; risk: string | null }[]) {
  await Promise.all(
    rows.map(async (r) => {
      const { error } = await db.from("grade_report_courses").update({ points: r.points, risk_level: r.risk }).eq("id", r.id);
      if (error) throw new Error(error.message);
    })
  );
}

/** حالات الترمات السابقة لهذا الترم، الأحدث أولاً */
export async function previousStandings(db: Db, studentId: string, termId: string) {
  const [{ data: terms }, { data: standings }] = await Promise.all([
    db.from("academic_terms").select("id, midterm_from").order("midterm_from", { ascending: false }),
    db.from("academic_standings").select("term_id, term_gpa, cum_gpa, term_credits").eq("student_id", studentId),
  ]);
  const list = terms ?? [];
  const current = list.find((t) => t.id === termId);
  const byTerm = new Map((standings ?? []).map((s) => [s.term_id, s]));
  return list
    .filter((t) => current && t.midterm_from < current.midterm_from)
    .map((t) => byTerm.get(t.id))
    .filter((s) => !!s)
    .map((s) => ({ termGpa: s.term_gpa, cumGpa: s.cum_gpa, credits: Number(s.term_credits) }));
}

const OPEN_STATUSES = ["open", "assigned", "in_progress"] as const;

/** المادة الضعيفة فعلاً ← اقتراح تلقائي؛ وإلا فالطالب هو من طلب الدعم */
const requestSource = (risk: string | null) => (risk === "fail" || risk === "struggling" || risk === "weak" || risk === "early_risk" ? "auto" : "student");

/** طلب دعم واحد مفتوح لكل طالب ومادة وترم: يُنشأ، أو تُرفع أولويته إن زادت */
async function upsertSupportRequest(
  db: Db,
  v: {
    studentId: string;
    termId: string;
    courseId: string;
    name: string;
    priority: SupportPriority;
    source: "auto" | "student";
    baselinePoints: number | null;
    baselinePercent: number | null;
  }
) {
  const { data: open } = await db
    .from("academic_support_requests")
    .select("id, subject, priority, term_id")
    .eq("student_id", v.studentId)
    .in("status", [...OPEN_STATUSES])
    .or(`term_id.eq.${v.termId},term_id.is.null`);
  const key = subjectKey(v.name);
  const existing = (open ?? []).find((r) => subjectKey(r.subject) === key);

  if (existing) {
    const current = existing.priority as SupportPriority | null;
    const raise = !current || PRIORITY_RANK[v.priority] > PRIORITY_RANK[current];
    const { error } = await db
      .from("academic_support_requests")
      .update({ term_id: v.termId, course_id: v.courseId, ...(raise ? { priority: v.priority } : {}) })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await db.from("academic_support_requests").insert({
    student_id: v.studentId,
    subject: v.name,
    description: v.source === "auto" ? "اقتراح تلقائي من كشف الدرجات" : "طلب الطالب الدعم في كشف الدرجات",
    status: "open",
    source: v.source,
    priority: v.priority,
    term_id: v.termId,
    course_id: v.courseId,
    baseline_points: v.baselinePoints,
    baseline_percent: v.baselinePercent,
  });
  if (error) throw new Error(error.message);
}

async function recordSupportOutcomes(db: Db, studentId: string, termId: string, courses: { id: string; course_name: string; points: number | null }[]) {
  const graded = courses.filter((c) => c.points !== null);
  if (!graded.length) return;
  const ids = new Set(courses.map((c) => c.id));
  const { data: requests } = await db
    .from("academic_support_requests")
    .select("id, subject, course_id, term_id")
    .eq("student_id", studentId)
    .neq("status", "closed")
    .is("outcome_points", null)
    .or(`term_id.eq.${termId},term_id.is.null`);
  for (const r of requests ?? []) {
    if (r.course_id && ids.has(r.course_id)) continue; // طلب وُلد من هذا الكشف نفسه: أثره في ترم لاحق
    const match = graded.find((c) => subjectKey(c.course_name) === subjectKey(r.subject));
    if (!match) continue;
    const { error } = await db.from("academic_support_requests").update({ outcome_points: match.points }).eq("id", r.id);
    if (error) throw new Error(error.message);
  }
}

/**
 * مواد الطالب في المتابعة (قوي / متعثر) تتحدث من آخر كشف: الراسب والمتعثر ← متعثر،
 * ٣٫٥ فأعلى ← قوي، والناجح بعد تعثّر يُرفع من قائمة المتعثرين. فتغذّي تبويب «المواد المشتركة».
 */
async function syncStudentSubjects(
  db: Db,
  studentId: string,
  courses: { name: string; risk: string | null; points: number | null; percent: number | null }[]
) {
  const relevant = courses.filter((c) => c.risk && c.risk !== "excluded");
  if (!relevant.length) return;
  const { data: catalog } = await db.from("academic_subjects").select("id, name");
  const idByKey = new Map((catalog ?? []).map((s) => [subjectKey(s.name), s.id]));

  for (const c of relevant) {
    const struggling = c.risk === "fail" || c.risk === "struggling" || c.risk === "early_risk";
    const strong = c.points !== null && c.points >= 3.5;
    let subjectId = idByKey.get(subjectKey(c.name));

    if (!struggling && !strong) {
      if (subjectId) await db.from("student_subjects").delete().eq("student_id", studentId).eq("subject_id", subjectId).eq("standing", "struggling");
      continue;
    }
    if (!subjectId) {
      const { data: created, error } = await db.from("academic_subjects").insert({ name: c.name.trim() }).select("id").single();
      if (error) throw new Error(error.message);
      subjectId = created.id;
      idByKey.set(subjectKey(c.name), subjectId);
    }
    const { error } = await db.from("student_subjects").upsert(
      {
        student_id: studentId,
        subject_id: subjectId,
        standing: struggling ? "struggling" : "strong",
        grade: c.percent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,subject_id" }
    );
    if (error) throw new Error(error.message);
  }
}

/**
 * جوائز الترم من حالات طلابه. المصروفة والملغاة لا تُمس، وتُحذف المستحقة/المعتمدة لمن لم يعد مؤهلاً.
 * يرجع معرّفات من صار مستحقاً لأول مرة (لإشعار التهنئة).
 */
export async function recomputeTermAwards(db: Db, termId: string, settings: ScholarshipSettings): Promise<string[]> {
  const [{ data: standings }, { data: existingRows }] = await Promise.all([
    db.from("academic_standings").select("student_id, term_gpa, cum_gpa, term_credits, has_fail").eq("term_id", termId),
    db.from("academic_awards").select("id, student_id, status, tier, amount, gpa_used").eq("term_id", termId),
  ]);
  const results = computeAwards(
    (standings ?? []).map((s) => ({
      studentId: s.student_id,
      termGpa: s.term_gpa,
      cumGpa: s.cum_gpa,
      credits: s.term_credits === null ? null : Number(s.term_credits),
      hasFail: s.has_fail,
    })),
    settings
  );
  const existing = new Map((existingRows ?? []).map((a) => [a.student_id, a]));
  const winners = new Set(results.map((r) => r.studentId));
  const created: string[] = [];

  for (const r of results) {
    const prev = existing.get(r.studentId);
    if (prev && (prev.status === "paid" || prev.status === "cancelled")) continue;
    if (prev && prev.tier === r.tier && Number(prev.amount) === r.amount && Number(prev.gpa_used) === r.gpa) continue;
    const { error } = await db.from("academic_awards").upsert(
      {
        student_id: r.studentId,
        term_id: termId,
        gpa_used: r.gpa,
        tier: r.tier,
        amount: r.amount,
        currency: settings.awardCurrency,
        status: "eligible",
        approved_by: null,
        approved_at: null,
      },
      { onConflict: "student_id,term_id" }
    );
    if (error) throw new Error(error.message);
    if (!prev) created.push(r.studentId);
  }

  const stale = (existingRows ?? []).filter((a) => !winners.has(a.student_id) && (a.status === "eligible" || a.status === "approved")).map((a) => a.id);
  if (stale.length) {
    const { error } = await db.from("academic_awards").delete().in("id", stale);
    if (error) throw new Error(error.message);
  }
  return created;
}
