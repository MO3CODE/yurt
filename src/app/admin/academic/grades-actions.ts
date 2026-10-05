"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, sendPush } from "@/lib/push";
import { formatShortDateISO } from "@/lib/date";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح");

const termSchema = z
  .object({
    name: z.string().trim().min(2, "اكتب اسم الترم").max(80),
    midterm_from: isoDate,
    midterm_to: isoDate,
    final_from: isoDate,
    final_to: isoDate,
  })
  .refine((t) => t.midterm_to >= t.midterm_from && t.final_to >= t.final_from, "نهاية الفترة قبل بدايتها")
  .refine((t) => t.final_from >= t.midterm_from, "فترة النهائي قبل فترة النصفي");

function parseTerm(formData: FormData) {
  return termSchema.parse(Object.fromEntries(["name", "midterm_from", "midterm_to", "final_from", "final_to"].map((k) => [k, formData.get(k)])));
}

function refresh() {
  revalidatePath("/admin/academic", "layout");
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

    // الإشعار عبر service role لأن صلاحية الإشعارات قد لا تكون لدى هذا الإداري
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      title: `رفع درجات ${v.name}`,
      body: `ارفع كشف النصفي بين ${formatShortDateISO(v.midterm_from)} و${formatShortDateISO(v.midterm_to)}، والنهائي بين ${formatShortDateISO(v.final_from)} و${formatShortDateISO(v.final_to)} من صفحة «درجاتي».`,
      target_type: "role",
      target_role: "student",
      created_by: user.id,
    });
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
const reviewSchema = z.object({ id: z.string().uuid(), termGpa: gpa, cumulativeGpa: gpa, note: z.string().trim().max(2000) });

/** تأكيد الكشف (أو تصحيح المعدل): يحدّث معدل الطالب في المتابعة ويُشعره */
export async function reviewGradeReport(input: z.input<typeof reviewSchema>) {
  return runAction(async () => {
    await assertPermission("academic");
    const v = reviewSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.rpc("review_grade_report", {
      p_id: v.id,
      p_term_gpa: v.termGpa,
      p_cumulative_gpa: v.cumulativeGpa,
      p_note: v.note,
    });
    if (error) throw new Error(error.message);

    try {
      if (pushConfigured()) {
        const admin = createAdminClient();
        const { data: rep } = await admin.from("grade_reports").select("student_id").eq("id", v.id).single();
        const { data: targets } = rep
          ? await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth_key").eq("profile_id", rep.student_id)
          : { data: [] };
        if (targets?.length) {
          await sendPush(targets, { title: "رُوجع كشف درجاتك ✓", body: v.note ? v.note.slice(0, 140) : "افتح «درجاتي» لترى التفاصيل", url: "/app/grades", tag: `grades-${v.id}` }, 86400);
        }
      }
    } catch (e) {
      console.error("grade review push", e);
    }
    refresh();
  });
}
