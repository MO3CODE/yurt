"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { assertPermission, hasPermission } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyAcademicRows, type AcademicRow } from "@/lib/academic-import-server";
import { generatePassword } from "@/lib/generate-password";
import type { Database } from "@/lib/supabase/types";
import { LOGIN_DOMAIN, USERNAME_RE, loginEmailFromPhone, loginEmailFromUsername } from "@/lib/student-import";
import { normalizeArabic } from "@/lib/academic";

const text = (max: number) => z.string().trim().max(max);

const rowSchema = z.object({
  line: z.number().int(),
  name: text(120).min(1),
  phone: z.string().regex(/^\d{8,15}$/).nullable(),
  email: z.string().email().max(160).nullable(),
  username: z.string().regex(USERNAME_RE).nullable(),
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
const chunkSchema = z.object({
  rows: z
    .array(rowSchema.refine((r) => r.phone || r.username, "رقم الهاتف أو اسم المستخدم مطلوب"))
    .min(1)
    .max(12),
});

export type ImportedStudent = {
  line: number;
  name: string;
  status: "created" | "updated" | "failed";
  error?: string;
  /** لمن أُنشئ حسابه فقط — لا تظهر كلمة المرور مرة أخرى */
  credentials?: { login: string; password: string; phone: string };
};

export type ImportChunkResult = { results: ImportedStudent[]; academicSkipped: boolean };

/** «عبدالملك باوزير» و«عبدالملك محمد باوزير» نفس الطالب: كل أجزاء الاسم الأقصر موجودة في الأطول */
function sameStudentName(a: string, b: string) {
  const [x, y] = [normalizeArabic(a).split(" "), normalizeArabic(b).split(" ")].sort((p, q) => p.length - q.length);
  const longer = new Set(y);
  return x.length > 0 && x.every((t) => longer.has(t));
}

export async function importStudentsChunk(input: z.input<typeof chunkSchema>): Promise<ActionResult<ImportChunkResult>> {
  return runAction(async () => {
    const user = await assertPermission("students");
    const { rows } = chunkSchema.parse(input);
    const admin = createAdminClient();
    const canAcademic = hasPermission(user, "academic");

    // من سُجّل رقمه من قبل يُحدَّث ولا يُنشأ له حساب ثانٍ — لكن فقط إن كان الاسم اسمه
    const { data: existingProfiles, error: lookupError } = await admin
      .from("profiles")
      .select("id, phone, full_name")
      .eq("role", "student")
      .in("phone", rows.map((r) => r.phone).filter((p): p is string => !!p));
    if (lookupError) throw new Error(lookupError.message);
    const existingByPhone = new Map((existingProfiles ?? []).map((p) => [p.phone, p]));

    // ومن له اسم مستخدم مسجّل يُحدَّث أيضاً (وهكذا يُضاف رقمه لاحقاً بإعادة الاستيراد)
    const existingByLogin = new Map<string, { id: string; full_name: string; phone: string | null }>();
    if (rows.some((r) => r.username)) {
      const logins = new Set(rows.filter((r) => r.username).map((r) => loginEmailFromUsername(r.username as string)));
      const ids = new Map<string, string>();
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new Error(error.message);
        for (const u of data.users) if (u.email && logins.has(u.email) && u.email.endsWith(`@${LOGIN_DOMAIN}`)) ids.set(u.id, u.email);
        if (data.users.length < 200) break;
      }
      if (ids.size) {
        const { data: profs } = await admin.from("profiles").select("id, full_name, phone").in("id", [...ids.keys()]);
        for (const p of profs ?? []) existingByLogin.set(ids.get(p.id) as string, p);
      }
    }

    const results: ImportedStudent[] = [];
    const academic: AcademicRow[] = [];
    const resultByStudent = new Map<string, ImportedStudent>();
    const apartments = new Set<string>();

    for (const row of rows) {
      try {
        const existing =
          (row.phone ? existingByPhone.get(row.phone) : undefined) ?? (row.username ? existingByLogin.get(loginEmailFromUsername(row.username)) : undefined);
        // رقم مؤقت أو خاطئ لطالب آخر لا يدمج الطالبين في حساب واحد
        if (existing && !sameStudentName(existing.full_name, row.name)) {
          throw new Error(`الرقم مسجّل لحساب «${existing.full_name}» — اكتب رقم هذا الطالب`);
        }
        let studentId = existing?.id ?? null;
        let credentials: ImportedStudent["credentials"];

        if (!studentId) {
          const password = generatePassword();
          const login = row.username ? loginEmailFromUsername(row.username) : (row.email ?? loginEmailFromPhone(row.phone as string));
          const { data: created, error: createError } = await admin.auth.admin.createUser({
            email: login,
            password,
            email_confirm: true,
            user_metadata: { full_name: row.name },
            app_metadata: { role: "student", must_change_password: true },
          });
          if (createError || !created.user) {
            const exists = createError?.code === "email_exists" || /already been registered/i.test(createError?.message ?? "");
            throw new Error(exists ? "اسم الدخول مسجّل مسبقاً لحساب آخر" : (createError?.message ?? "تعذّر إنشاء الحساب"));
          }
          studentId = created.user.id;
          credentials = { login, password, phone: row.phone ?? "" };

          if (row.phone) {
            const { error: profileError } = await admin.from("profiles").update({ phone: row.phone }).eq("id", studentId);
            if (profileError) {
              await admin.auth.admin.deleteUser(studentId); // لا نترك حساباً ناقصاً
              throw new Error(profileError.message);
            }
          }
        } else if (row.phone && existing && !existing.phone) {
          // طالب أُضيف باسم مستخدم: وصل رقمه الآن
          const { error: phoneError } = await admin.from("profiles").update({ phone: row.phone }).eq("id", studentId);
          if (phoneError) throw new Error(phoneError.message);
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
