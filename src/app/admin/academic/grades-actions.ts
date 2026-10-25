"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, sendPush } from "@/lib/push";
import { formatShortDateISO } from "@/lib/date";
import { courseSchema } from "@/lib/grades";
import { applyReportAnalysis, getScholarshipConfig, previousStandings, recomputeTerm, recomputeTermAwards } from "@/lib/scholarship-server";
import { STATUS_META, TIER_META, round2, standingWithHistory, type AwardTier, type PriorStanding } from "@/lib/scholarship";
import { historicalTermDates } from "@/lib/term-import";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح");

const optionalDate = isoDate.nullable();
const termSchema = z
  .object({
    name: z.string().trim().min(2, "اكتب اسم الترم").max(80),
    midterm_from: optionalDate,
    midterm_to: optionalDate,
    final_from: optionalDate,
    final_to: optionalDate,
  })
  .refine((t) => !t.midterm_from === !t.midterm_to && !t.final_from === !t.final_to, "حدّد بداية الفترة ونهايتها معاً، أو اتركهما فارغتين")
  .refine((t) => (!t.midterm_from || t.midterm_to! >= t.midterm_from) && (!t.final_from || t.final_to! >= t.final_from), "نهاية الفترة قبل بدايتها")
  .refine((t) => !t.final_from || !t.midterm_from || t.final_from >= t.midterm_from, "فترة النهائي قبل فترة النصفي");

function parseTerm(formData: FormData) {
  return termSchema.parse(
    Object.fromEntries(["name", "midterm_from", "midterm_to", "final_from", "final_to"].map((k) => [k, formData.get(k) || (k === "name" ? "" : null)]))
  );
}

function refresh() {
  revalidatePath("/admin/academic", "layout");
  revalidatePath("/admin/academic-support");
  revalidatePath("/app/grades");
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}

/** ترم جديد بفترتي رفع، مع إشعار لكل الطلاب */
export async function createTerm(formData: FormData) {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = parseTerm(formData);
    const supabase = await createClient();
    const { data, error } = await supabase.from("academic_terms").insert({ ...v, created_by: user.id }).select("id").single();
    if (error) throw new Error(error.message);

    // الإشعار عبر service role لأن صلاحية الإشعارات قد لا تكون لدى هذا الإداري؛ ترم بلا فترات بعد لا إشعار له
    if (v.midterm_from && v.final_from) {
      const admin = createAdminClient();
      await admin.from("notifications").insert({
        title: `رفع درجات ${v.name}`,
        body: `ارفع كشف النصفي بين ${formatShortDateISO(v.midterm_from)} و${formatShortDateISO(v.midterm_to!)}، والنهائي بين ${formatShortDateISO(v.final_from)} و${formatShortDateISO(v.final_to!)} من صفحة «درجاتي».`,
        target_type: "role",
        target_role: "student",
        created_by: user.id,
      });
    }
    refresh();
    return { id: data.id };
  });
}

export async function updateTerm(termId: string, formData: FormData) {
  return runAction(async () => {
    await assertPermission("academic");
    const v = parseTerm(formData);
    const supabase = await createClient();
    const { error } = await supabase.from("academic_terms").update(v).eq("id", z.string().uuid().parse(termId));
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function deleteTerm(termId: string) {
  return runAction(async () => {
    await assertPermission("academic");
    const supabase = await createClient();
    const { error } = await supabase.from("academic_terms").delete().eq("id", z.string().uuid().parse(termId));
    if (error) throw new Error(error.message);
    refresh();
  });
}

const gpa = z.number().min(0).max(4).nullable();
const reviewSchema = z.object({
  id: z.string().uuid(),
  termGpa: gpa,
  cumulativeGpa: gpa,
  note: z.string().trim().max(2000),
  // إن صحّحت الإدارة المواد تُستبدل قبل التحليل
  courses: z.array(courseSchema).max(15).nullable(),
});

async function pushToStudent(studentId: string, payload: { title: string; body: string; url: string; tag: string }) {
  try {
    if (!pushConfigured()) return;
    const admin = createAdminClient();
    const { data: targets } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth_key").eq("profile_id", studentId);
    if (targets?.length) await sendPush(targets, payload, 86400);
  } catch (e) {
    console.error("grades push", e);
  }
}

/**
 * تأكيد الكشف (أو تصحيح المعدل والمواد): يحدّث معدل الطالب في المتابعة ويُشعره،
 * ثم يحلّل الكشف: تصنيف المواد، حالة المنحة، طلبات الدعم، وجوائز الترم
 */
export async function reviewGradeReport(input: z.input<typeof reviewSchema>) {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = reviewSchema.parse(input);
    const supabase = await createClient();

    const { data: rep } = await supabase.from("grade_reports").select("student_id, term_id, kind").eq("id", v.id).single();
    if (!rep) throw new Error("الكشف غير موجود");

    if (v.courses) {
      if (v.courses.length === 0) throw new Error("أضف مواد الكشف");
      const { error: delError } = await supabase.from("grade_report_courses").delete().eq("report_id", v.id);
      if (delError) throw new Error(delError.message);
      const { error: insError } = await supabase.from("grade_report_courses").insert(
        v.courses.map((c, i) => ({
          report_id: v.id,
          student_id: rep.student_id,
          sort_order: i,
          course_name: c.courseName,
          course_code: c.courseCode,
          credits: c.credits,
          letter: rep.kind === "final" ? c.letter : null,
          percent: rep.kind === "midterm" ? c.percent : null,
          is_repeat: c.isRepeat,
          help_requested: c.helpRequested,
        }))
      );
      if (insError) throw new Error(insError.message);
    }

    const { error } = await supabase.rpc("review_grade_report", {
      p_id: v.id,
      p_term_gpa: v.termGpa,
      p_cumulative_gpa: v.cumulativeGpa,
      p_note: v.note,
    });
    if (error) throw new Error(error.message);

    const summary = await applyReportAnalysis(supabase, v.id);

    await pushToStudent(rep.student_id, {
      title: "رُوجع كشف درجاتك ✓",
      body: summary.status ? `حالتك مع المنحة: ${STATUS_META[summary.status].label}` : v.note ? v.note.slice(0, 140) : "افتح «درجاتي» لترى التفاصيل",
      url: "/app/grades",
      tag: `grades-${v.id}`,
    });

    // تهنئة من صار مؤهلاً للجائزة لأول مرة
    if (summary.newAwardStudentIds.length) {
      const admin = createAdminClient();
      const { data: awards } = await admin
        .from("academic_awards")
        .select("student_id, tier, amount, currency")
        .eq("term_id", rep.term_id)
        .in("student_id", summary.newAwardStudentIds);
      const { data: term } = await admin.from("academic_terms").select("name").eq("id", rep.term_id).single();
      for (const a of awards ?? []) {
        const tier = TIER_META[a.tier as AwardTier];
        const body = `${tier.medal} أنت من المتميزين في ${term?.name ?? "هذا الترم"} — الفئة ${tier.label}، جائزة ${a.amount} ${a.currency}.`;
        await admin.from("notifications").insert({ title: "مبارك! جائزة التميز الأكاديمي", body, target_type: "student", target_student_id: a.student_id, created_by: user.id });
        await pushToStudent(a.student_id, { title: "مبارك! جائزة التميز الأكاديمي", body, url: "/app/grades", tag: `award-${rep.term_id}` });
      }
    }

    refresh();
    return summary;
  });
}

/** إعادة الكشف للطالب بملاحظة ليعدّله (حتى بعد تأكيده) */
export async function returnGradeReport(input: { id: string; note: string }) {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = z.object({ id: z.string().uuid(), note: z.string().trim().min(3, "اكتب للطالب ما الذي يعدّله").max(2000) }).parse(input);
    // لا سياسة تعديل للإدارة على الكشوف (التأكيد عبر دالة)، فالإعادة عبر service role بعد التحقق من الصلاحية
    const admin = createAdminClient();
    const { data: rep, error } = await admin
      .from("grade_reports")
      .update({ status: "returned", admin_note: v.note, reviewed_by: null, reviewed_at: null, verified_term_gpa: null, verified_cumulative_gpa: null, updated_at: new Date().toISOString() })
      .eq("id", v.id)
      .select("student_id, kind, term_id")
      .single();
    if (error || !rep) throw new Error(error?.message ?? "الكشف غير موجود");
    const { data: term } = await admin.from("academic_terms").select("name").eq("id", rep.term_id).single();
    const title = "أُعيد كشف درجاتك للتعديل";
    const body = `${term?.name ?? ""} — ${rep.kind === "midterm" ? "النصفي" : "النهائي"}: ${v.note.slice(0, 160)}`;
    await admin.from("notifications").insert({ title, body, target_type: "student", target_student_id: rep.student_id, created_by: user.id });
    await pushToStudent(rep.student_id, { title, body, url: "/app/grades", tag: `grades-${v.id}` });
    refresh();
  });
}

/** إعادة حساب ترم كامل بعد تغيير الإعدادات (الجوائز المصروفة لا تتغير) */
export async function recomputeTermAction(termId: string) {
  return runAction(async () => {
    await assertPermission("academic");
    const supabase = await createClient();
    const count = await recomputeTerm(supabase, z.string().uuid().parse(termId));
    refresh();
    return { count };
  });
}

const termResult = z
  .object({
    courses: z.number().int().min(0).max(30).nullable(),
    passed: z.number().int().min(0).max(30).nullable(),
    failed: z.number().int().min(0).max(30).nullable(),
    gpa: z.number().min(0).max(4),
  })
  .nullable();

const importSchema = z.object({
  startYear: z.number().int().min(2015).max(2100),
  fallName: z.string().trim().min(2).max(80),
  springName: z.string().trim().min(2).max(80),
  rows: z
    .array(z.object({ studentId: z.string().uuid(), t1: termResult, t2: termResult, overall: z.number().min(0).max(4).nullable() }))
    .min(1, "لا صفوف مطابقة للاستيراد")
    .max(300),
});

/**
 * استيراد نتائج سنة دراسية من تقرير: يُنشئ الترمين «أرشيفيين» (بلا مهمة رفع ولا إشعار) إن لم يوجدا،
 * ويسجّل حالة كل طالب في كل ترم، ويحدّث معدله، ويحسب جوائز الترمين. إعادة الاستيراد تستبدل ولا تكرر،
 * ولا تمس حالة ترم حُسبت من كشف رفعه الطالب.
 */
export async function importTermResults(input: z.input<typeof importSchema>) {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = importSchema.parse(input);
    const supabase = await createClient();
    const { settings } = await getScholarshipConfig(supabase);
    const dates = historicalTermDates(v.startYear);

    async function termId(name: string, range: { from: string; to: string }) {
      const { data: existing } = await supabase.from("academic_terms").select("id").eq("name", name).maybeSingle();
      if (existing) return existing.id;
      const { data, error } = await supabase
        .from("academic_terms")
        .insert({ name, historical: true, midterm_from: range.from, midterm_to: range.to, final_from: range.from, final_to: range.to, created_by: user.id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    }
    const fallId = await termId(v.fallName, dates.fall);
    const springId = await termId(v.springName, dates.spring);

    const { data: fromReports } = await supabase
      .from("academic_standings")
      .select("student_id, term_id")
      .in("term_id", [fallId, springId])
      .eq("source", "report");
    const locked = new Set((fromReports ?? []).map((r) => `${r.student_id}:${r.term_id}`));

    let written = 0;
    for (const row of v.rows) {
      const older = await previousStandings(supabase, row.studentId, fallId);
      const save = async (termIdValue: string, t: NonNullable<typeof row.t1>, cum: number, official: boolean, previous: PriorStanding[]) => {
        const { status, flags } = standingWithHistory({ termGpa: t.gpa, cumGpa: cum, credits: null, previous, settings });
        if (locked.has(`${row.studentId}:${termIdValue}`) || !status) return;
        const { error } = await supabase.from("academic_standings").upsert(
          {
            student_id: row.studentId,
            term_id: termIdValue,
            report_id: null,
            term_gpa: t.gpa,
            cum_gpa: cum,
            calc_term_gpa: null,
            term_credits: null,
            courses_count: t.courses,
            passed_count: t.passed,
            failed_count: t.failed,
            has_fail: (t.failed ?? 0) > 0,
            gpa_source: official ? "official" : "calculated",
            status,
            flags,
            source: "import",
            computed_at: new Date().toISOString(),
          },
          { onConflict: "student_id,term_id" }
        );
        if (error) throw new Error(error.message);
        written++;
      };

      // تراكمي نهاية الفصل الأول لا يذكره التقرير إلا إن لم يوجد فصل ثانٍ؛ وإلا يُقدَّر بمعدل الفصل الأول
      let fallCum: number | null = null;
      if (row.t1) {
        const official = !row.t2 && row.overall !== null;
        fallCum = official ? (row.overall as number) : row.t1.gpa;
        await save(fallId, row.t1, fallCum, official, older);
      }
      if (row.t2) {
        const c1 = row.t1?.courses ?? 0;
        const c2 = row.t2.courses ?? 0;
        const estimated = row.t1 && c1 + c2 > 0 ? round2((row.t1.gpa * c1 + row.t2.gpa * c2) / (c1 + c2)) : row.t2.gpa;
        const previous = row.t1 ? [{ termGpa: row.t1.gpa, cumGpa: fallCum, credits: 0 }, ...older] : older;
        await save(springId, row.t2, row.overall ?? estimated, row.overall !== null, previous);
      }

      const latest = row.overall ?? row.t2?.gpa ?? row.t1?.gpa ?? null;
      if (latest !== null) {
        const { error } = await supabase
          .from("student_academic_profiles")
          .upsert({ student_id: row.studentId, gpa: latest, gpa_scale: 4 }, { onConflict: "student_id" });
        if (error) throw new Error(error.message);
      }
    }

    await recomputeTermAwards(supabase, fallId, settings);
    await recomputeTermAwards(supabase, springId, settings);
    refresh();
    return { students: v.rows.length, standings: written, springId };
  });
}
