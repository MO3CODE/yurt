"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/current-user";
import { generatePassword } from "@/lib/generate-password";

const newStudentSchema = z.object({
  full_name: z.string().min(1, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صحيح"),
  phone: z.string().min(6, "رقم الجوال مطلوب (بصيغة دولية مثل 9677xxxxxxx)"),
  apartment_id: z.string().uuid().optional().or(z.literal("")),
  university_name: z.string().optional(),
  major: z.string().optional(),
});

export type CreateStudentResult = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
};

// ننشئ الحساب مباشرة بكلمة مرور مُولَّدة بدل الاعتماد على بريد دعوة —
// خدمة بريد Supabase الافتراضية محدودة جداً (للتجربة فقط) وسريعة الانقطاع
// (email rate limit). كلمة المرور تُرسل للطالب يدوياً عبر واتساب من لوحة الإدارة.
export async function createStudent(formData: FormData): Promise<ActionResult<CreateStudentResult>> {
  return runAction(async () => {
    await requireAdmin();

    const parsed = newStudentSchema.parse({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      apartment_id: formData.get("apartment_id") || "",
      university_name: formData.get("university_name") || undefined,
      major: formData.get("major") || undefined,
    });

    // واتساب يحتاج أرقاماً فقط بصيغة دولية (بدون + أو 00)
    const phone = parsed.phone.replace(/\D/g, "").replace(/^00/, "");
    if (phone.length < 8) throw new Error("رقم الجوال غير صحيح — اكتبه بصيغة دولية مثل 905xxxxxxxxx");

    const admin = createAdminClient();
    const password = generatePassword();
    const email = parsed.email.trim().toLowerCase();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: parsed.full_name },
      // الدور في app_metadata لأن المستخدم لا يستطيع تعديلها (بخلاف user_metadata)
      app_metadata: { role: "student" },
    });

    if (createError || !created.user) {
      if (createError?.code === "email_exists" || /already been registered/i.test(createError?.message ?? "")) {
        throw new Error("هذا البريد مسجّل مسبقاً لطالب آخر");
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
      admin.from("profiles").update({ phone }).eq("id", userId),
    ]);

    if (studentError || profileError) {
      // لا نترك حساباً ناقصاً معلّقاً
      await admin.auth.admin.deleteUser(userId);
      throw new Error((studentError ?? profileError)!.message);
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/apartments", "layout");
    revalidatePath("/admin");

    return { fullName: parsed.full_name, email, password, phone };
  });
}

// لا يوجد بريد لاستعادة كلمة المرور، فالإدارة تولّد كلمة جديدة وترسلها عبر واتساب
export async function resetStudentPassword(studentId: string): Promise<ActionResult<CreateStudentResult>> {
  return runAction(async () => {
    await requireAdmin();
    const admin = createAdminClient();

    const [{ data: userData, error: userError }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(studentId),
      admin.from("profiles").select("full_name, phone").eq("id", studentId).single(),
    ]);
    if (userError || !userData.user?.email) throw new Error(userError?.message ?? "الطالب غير موجود");

    const password = generatePassword();
    const { error } = await admin.auth.admin.updateUserById(studentId, { password });
    if (error) throw new Error(error.message);

    return {
      fullName: profile?.full_name ?? userData.user.email,
      email: userData.user.email,
      password,
      phone: profile?.phone ?? "",
    };
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
    await requireAdmin();
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
    revalidatePath(`/admin/students/${studentId}`);
    revalidatePath("/admin/students");
  });
}
