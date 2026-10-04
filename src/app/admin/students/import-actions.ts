"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { assertPermission, hasPermission } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyAcademicRows, type AcademicRow } from "@/lib/academic-import-server";
import { generatePassword } from "@/lib/generate-password";
import type { Database } from "@/lib/supabase/types";
import { loginEmailFromPhone } from "@/lib/student-import";

const text = (max: number) => z.string().trim().max(max);

const rowSchema = z.object({
  line: z.number().int(),
  name: text(120).min(1),
  phone: z.string().regex(/^\d{8,15}$/),
  email: z.string().email().max(160).nullable(),
  major: text(120),
  university: text(120),
  academicYear: text(60),
  apartmentId: z.string().uuid().nullable(),
  gpa: z.number().min(0).nullable(),
  gpaScale: z.number().positive().max(100),
  strong: z.array(text(80).min(1)).max(30),
  struggling: z.array(text(80).min(1)).max(30),
});

// الواجهة ترسل الصفوف على دفعات صغيرة (إنشاء حساب لكل طالب بطيء نسبياً)
const chunkSchema = z.object({ rows: z.array(rowSchema).min(1).max(12) });

export type ImportedStudent = {
  line: number;
  name: string;
  status: "created" | "updated" | "failed";
  error?: string;
  /** لمن أُنشئ حسابه فقط — لا تظهر كلمة المرور مرة أخرى */
  credentials?: { login: string; password: string; phone: string };
};

export type ImportChunkResult = { results: ImportedStudent[]; academicSkipped: boolean };

export async function importStudentsChunk(input: z.input<typeof chunkSchema>): Promise<ActionResult<ImportChunkResult>> {
  return runAction(async () => {
    const user = await assertPermission("students");
    const { rows } = chunkSchema.parse(input);
    const admin = createAdminClient();
    const canAcademic = hasPermission(user, "academic");

    // من سُجّل رقمه من قبل يُحدَّث ولا يُنشأ له حساب ثانٍ
    const { data: existingProfiles, error: lookupError } = await admin
      .from("profiles")
      .select("id, phone")
      .eq("role", "student")
      .in("phone", rows.map((r) => r.phone));
    if (lookupError) throw new Error(lookupError.message);
    const existingByPhone = new Map((existingProfiles ?? []).map((p) => [p.phone, p.id]));

    const results: ImportedStudent[] = [];
    const academic: AcademicRow[] = [];
    const resultByStudent = new Map<string, ImportedStudent>();
    const apartments = new Set<string>();

    for (const row of rows) {
      try {
        let studentId = existingByPhone.get(row.phone) ?? null;
        let credentials: ImportedStudent["credentials"];

        if (!studentId) {
          const password = generatePassword();
          const login = row.email ?? loginEmailFromPhone(row.phone);
          const { data: created, error: createError } = await admin.auth.admin.createUser({
            email: login,
            password,
            email_confirm: true,
            user_metadata: { full_name: row.name },
            app_metadata: { role: "student" },
          });
          if (createError || !created.user) {
            const exists = createError?.code === "email_exists" || /already been registered/i.test(createError?.message ?? "");
            throw new Error(exists ? "اسم الدخول مسجّل مسبقاً لحساب آخر" : (createError?.message ?? "تعذّر إنشاء الحساب"));
          }
          studentId = created.user.id;
          credentials = { login, password, phone: row.phone };

          const { error: profileError } = await admin.from("profiles").update({ phone: row.phone }).eq("id", studentId);
          if (profileError) {
            await admin.auth.admin.deleteUser(studentId); // لا نترك حساباً ناقصاً
            throw new Error(profileError.message);
          }
        }

        // الحقول الفارغة في الملف لا تمسح ما هو مسجّل (مهم لتحديث طالب موجود)
        const patch: Database["public"]["Tables"]["students"]["Update"] = {};
        if (row.university) patch.university_name = row.university;
        if (row.major) patch.major = row.major;
        if (row.academicYear) patch.academic_year = row.academicYear;
        if (row.apartmentId) patch.apartment_id = row.apartmentId;
        if (Object.keys(patch).length > 0) {
          const { error: studentError } = await admin.from("students").update(patch).eq("id", studentId);
          if (studentError) {
            if (credentials) await admin.auth.admin.deleteUser(studentId);
            throw new Error(studentError.message);
          }
        }
        if (row.apartmentId) apartments.add(row.apartmentId);

        if (row.gpa !== null || row.strong.length + row.struggling.length > 0) {
          academic.push({ studentId, gpa: row.gpa, gpaScale: row.gpaScale, strong: row.strong, struggling: row.struggling });
        }

        const result: ImportedStudent = { line: row.line, name: row.name, status: credentials ? "created" : "updated", credentials };
        results.push(result);
        resultByStudent.set(studentId, result);
      } catch (e) {
        results.push({ line: row.line, name: row.name, status: "failed", error: e instanceof Error ? e.message : "تعذّر الاستيراد" });
      }
    }

    // البيانات الأكاديمية حساسة: تُكتب فقط لمن يملك صلاحية «academic»
    if (canAcademic && academic.length > 0) {
      try {
        await applyAcademicRows(admin, academic, { replace: false });
      } catch (e) {
        const message = e instanceof Error ? e.message : "تعذّر حفظ البيانات الأكاديمية";
        for (const a of academic) {
          const r = resultByStudent.get(a.studentId);
          if (r) r.error = `الحساب جاهز لكن ${message}`;
        }
      }
    }

    // يملأ مهام النظافة غير المعيّنة في شققهم (لا يغيّر ما وُزّع)
    for (const apartmentId of apartments) await admin.rpc("generate_cleaning_schedule", { p_apartment: apartmentId });

    revalidatePath("/admin/students");
    revalidatePath("/admin/apartments", "layout");
    revalidatePath("/admin/academic", "layout");
    revalidatePath("/admin");

    return { results, academicSkipped: !canAcademic && rows.some((r) => r.gpa !== null || r.strong.length + r.struggling.length > 0) };
  });
}
