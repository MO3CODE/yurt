"use server";

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
export async function createStudent(formData: FormData): Promise<CreateStudentResult> {
  await requireAdmin();

  const parsed = newStudentSchema.parse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    apartment_id: formData.get("apartment_id") || "",
    university_name: formData.get("university_name") || undefined,
    major: formData.get("major") || undefined,
  });

  const admin = createAdminClient();
  const password = generatePassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: parsed.full_name, role: "student" },
  });

  if (createError || !created.user) {
    throw new Error(createError?.message ?? "تعذّر إنشاء حساب الطالب");
  }

  // handle_new_user trigger أنشأ صفوف profiles + students تلقائياً؛ نُكمل البيانات الآن
  const { error: updateError } = await admin
    .from("students")
    .update({
      apartment_id: parsed.apartment_id || null,
      university_name: parsed.university_name || null,
      major: parsed.major || null,
    })
    .eq("id", created.user.id);

  if (updateError) throw new Error(updateError.message);

  await admin.from("profiles").update({ phone: parsed.phone }).eq("id", created.user.id);

  revalidatePath("/admin/students");

  return { fullName: parsed.full_name, email: parsed.email, password, phone: parsed.phone };
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
  await requireAdmin();
  const parsed = updateStudentSchema.parse({
    apartment_id: formData.get("apartment_id") || "",
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
}
