"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

const gpa = z.number().min(0).max(4);
const tier = z.enum(["gold", "silver", "bronze"]);

const settingsSchema = z
  .object({
    statusBands: z.object({ excellent: gpa, safe: gpa, watch: gpa }),
    probationTerms: z.number().int().min(1).max(6),
    gpaMismatchTolerance: z.number().min(0).max(1),
    sharpDropThreshold: z.number().min(0).max(4),
    minTermCredits: z.number().min(0).max(40),
    strugglingBelow: gpa,
    weakBelow: gpa,
    midtermRiskPercent: z.number().min(0).max(100),
    groupTutoringMin: z.number().int().min(2).max(30),
    awardMode: z.enum(["bands", "rank"]),
    awardBasis: z.enum(["term", "cumulative"]),
    awardMinGpa: gpa,
    awardRequireNoFail: z.boolean(),
    awardBands: z.array(z.object({ tier, min: gpa, amount: z.number().min(0).max(100000) })).min(1).max(3),
    awardRankSlots: z.array(z.object({ tier, count: z.number().int().min(0).max(30), amount: z.number().min(0).max(100000) })).min(1).max(3),
    awardCurrency: z.string().trim().min(3).max(5),
  })
  .refine((s) => s.statusBands.excellent >= s.statusBands.safe && s.statusBands.safe >= s.statusBands.watch, "حدود الحالات يجب أن تكون: متميز ≥ آمن ≥ مراقبة")
  .refine((s) => s.weakBelow >= s.strugglingBelow, "حد «ضعيف» يجب أن يكون أعلى من حد «متعثر»");

/** حفظ الإعدادات — لا تتغير الترمات المؤكَّدة إلا بزر «إعادة حساب الترم» */
export async function saveScholarshipSettings(input: z.input<typeof settingsSchema>) {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = settingsSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("academic_settings")
      .upsert({ id: true, value: { ...v, awardCurrency: v.awardCurrency.toUpperCase() }, updated_by: user.id, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/academic", "layout");
    revalidatePath("/app/grades");
  });
}

const scaleSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,20}$/, "المعرّف حروف إنجليزية صغيرة وأرقام"),
  name: z.string().trim().min(2).max(60),
  items: z
    .array(z.object({ letter: z.string().trim().min(1).max(4), points: z.number().min(0).max(4).nullable() }))
    .min(2, "أضف رمزين على الأقل")
    .max(30)
    .refine((xs) => new Set(xs.map((x) => x.letter.toUpperCase())).size === xs.length, "رمز مكرر في السلّم"),
});

export async function saveGradeScale(input: z.input<typeof scaleSchema>) {
  return runAction(async () => {
    await assertPermission("academic");
    const v = scaleSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("academic_grade_scales").upsert({ key: v.key, name: v.name, items: v.items });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/academic", "layout");
    revalidatePath("/app/grades");
  });
}

/** سلّم درجات الطالب (حسب جامعته) */
export async function setStudentGradeScale(studentId: string, scaleKey: string) {
  return runAction(async () => {
    await assertPermission("academic");
    const supabase = await createClient();
    const { error } = await supabase
      .from("student_academic_profiles")
      .upsert({ student_id: z.string().uuid().parse(studentId), grade_scale: z.string().min(2).max(20).parse(scaleKey) }, { onConflict: "student_id" });
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/academic/${studentId}`);
    revalidatePath("/admin/academic/grades");
  });
}
