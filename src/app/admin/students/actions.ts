"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/auth/current-user";
import { generatePassword } from "@/lib/generate-password";
import { issueNewPassword, type AccountCredentials } from "@/lib/auth/credentials";
import { USERNAME_RE, isValidPhone, loginEmailFromPhone, loginEmailFromUsername, normalizePhone, normalizeUsername } from "@/lib/student-import";

const newStudentSchema = z.object({
  full_name: z.string().min(1, "الاسم مطلوب"),
  username: z.string().regex(USERNAME_RE, "اسم المستخدم: حروف إنجليزية وأرقام و . _ - ويبدأ بحرف (٣ أحرف فأكثر)").optional(),
  email: z.string().email("بريد إلكتروني غير صحيح").optional(),
  phone: z.string().optional(),
  apartment_id: z.string().uuid().optional().or(z.literal("")),
  university_name: z.string().optional(),
  major: z.string().optional(),
});

export type CreateStudentResult = AccountCredentials;

// ننشئ الحساب مباشرة بكلمة مرور مُولَّدة بدل الاعتماد على بريد دعوة —
// خدمة بريد Supabase الافتراضية محدودة جداً (للتجربة فقط) وسريعة الانقطاع
// (email rate limit). كلمة المرور تُرسل للطالب يدوياً عبر واتساب من لوحة الإدارة.
export async function createStudent(formData: FormData): Promise<ActionResult<CreateStudentResult>> {
  return runAction(async () => {
    await assertPermission("students");

    const usernameRaw = String(formData.get("username") ?? "").trim();
    const parsed = newStudentSchema.parse({
      full_name: formData.get("full_name"),
      username: usernameRaw ? normalizeUsername(usernameRaw) : undefined,
      email: String(formData.get("email") ?? "").trim() || undefined,
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      apartment_id: formData.get("apartment_id") || "",
      university_name: formData.get("university_name") || undefined,
      major: formData.get("major") || undefined,
    });

    // واتساب يحتاج أرقاماً فقط بصيغة دولية (بدون + أو 00)؛ الرقم اختياري لمن له اسم مستخدم
    const phone = parsed.phone ? normalizePhone(parsed.phone) : "";
    if (parsed.phone && !isValidPhone(phone)) throw new Error("رقم الجوال غير صحيح — اكتبه بصيغة دولية مثل 905xxxxxxxxx");
    if (!phone && !parsed.username && !parsed.email) throw new Error("اكتب اسم المستخدم أو رقم الجوال (أحدهما اسم الدخول)");

    const admin = createAdminClient();
    const password = generatePassword();
    // اسم الدخول: اسم المستخدم، ثم البريد، ثم الرقم
    const email = parsed.username ? loginEmailFromUsername(parsed.username) : parsed.email ? parsed.email.toLowerCase() : loginEmailFromPhone(phone);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: parsed.full_name },
      // الدور في app_metadata لأن المستخدم لا يستطيع تعديلها (بخلاف user_metadata)
      app_metadata: { role: "student", must_change_password: true },
    });

    if (createError || !created.user) {
      if (createError?.code === "email_exists" || /already been registered/i.test(createError?.message ?? "")) {
        throw new Error(parsed.username ? "اسم المستخدم مستخدم لحساب آخر — اختر غيره" : "اسم الدخول مسجّل مسبقاً لحساب آخر");
      }
      throw new Error(createError?.message ?? "تعذّر إنشاء حساب الطالب");
    }

    const userId = created.user.id;

    // handle_new_user trigger أنشأ صفوف profiles + students تلقائياً؛ نُكمل البيانات الآن
    const [{ error: studentError }, { error: profileError }] = await Promise.all([
      admin
        .from("students")
        .update({
          apartment_id: parsed.apartment_id || null,
          university_name: parsed.university_name || null,
          major: parsed.major || null,
        })
        .eq("id", userId),
      admin.from("profiles").update({ phone: phone || null }).eq("id", userId),
    ]);

    if (studentError || profileError) {
      // لا نترك حساباً ناقصاً معلّقاً
      await admin.auth.admin.deleteUser(userId);
      throw new Error((studentError ?? profileError)!.message);
    }

    // يملأ مهام النظافة غير المعيّنة في شقته لهذا الأسبوع (لا يغيّر ما وُزّع)
    if (parsed.apartment_id) await admin.rpc("generate_cleaning_schedule", { p_apartment: parsed.apartment_id });

    revalidatePath("/admin/students");
    revalidatePath("/admin/apartments", "layout");
    revalidatePath("/admin");

    return { fullName: parsed.full_name, email, password, phone };
  });
}

// لا يوجد بريد لاستعادة كلمة المرور، فالإدارة تولّد كلمة جديدة وترسلها عبر واتساب
export async function resetStudentPassword(studentId: string): Promise<ActionResult<CreateStudentResult>> {
  return runAction(async () => {
    await assertPermission("students");
    return issueNewPassword(studentId, ["student"]);
  });
}

const updateStudentSchema = z.object({
  apartment_id: z.string().uuid().optional().or(z.literal("")),
  university_name: z.string().optional(),
  major: z.string().optional(),
  academic_year: z.string().optional(),
  status: z.enum(["active", "on_leave", "graduated", "withdrawn"]),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function updateStudent(studentId: string, formData: FormData) {
  return runAction(async () => {
    await assertPermission("students");
    const apartmentId = formData.get("apartment_id");
    const parsed = updateStudentSchema.parse({
      // "none" = خيار «بدون شقة» في القائمة
      apartment_id: apartmentId === "none" ? "" : apartmentId || "",
      university_name: formData.get("university_name") || undefined,
      major: formData.get("major") || undefined,
      academic_year: formData.get("academic_year") || undefined,
      status: formData.get("status"),
      emergency_contact_name: formData.get("emergency_contact_name") || undefined,
      emergency_contact_phone: formData.get("emergency_contact_phone") || undefined,
      notes: formData.get("notes") || undefined,
    });

    const supabase = await createClient();
    const { error } = await supabase
      .from("students")
      .update({ ...parsed, apartment_id: parsed.apartment_id || null })
      .eq("id", studentId);

    if (error) throw new Error(error.message);

    // رقم الجوال (واتساب) — لا يغيّر اسم الدخول
    if (formData.has("phone")) {
      const raw = String(formData.get("phone") ?? "").trim();
      const phone = raw ? normalizePhone(raw) : null;
      if (phone && !isValidPhone(phone)) throw new Error("رقم الجوال غير صحيح — اكتبه بصيغة دولية مثل 905xxxxxxxxx");
      const { error: phoneError } = await supabase.from("profiles").update({ phone }).eq("id", studentId);
      if (phoneError) throw new Error(phoneError.message);
    }

    // المشرف الذي نُقل لشقة أخرى أو لم يعد نشطاً يفقد إشرافه على الشقة القديمة
    // (وإلا تبقى له صلاحيات RLS على طلابها)
    let supervision = supabase.from("apartments").update({ supervisor_id: null }).eq("supervisor_id", studentId);
    if (parsed.status === "active" && parsed.apartment_id) supervision = supervision.neq("id", parsed.apartment_id);
    const { error: supervisionError } = await supervision;
    if (supervisionError) throw new Error(supervisionError.message);

    revalidatePath(`/admin/students/${studentId}`);
    revalidatePath("/admin/students");
    revalidatePath("/admin/apartments", "layout");
  });
}
