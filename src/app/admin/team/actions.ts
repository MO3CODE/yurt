"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSuperAdmin } from "@/lib/auth/current-user";
import { issueNewPassword, type AccountCredentials } from "@/lib/auth/credentials";
import { generatePassword } from "@/lib/generate-password";
import { isPermissionKey, type PermissionKey } from "@/lib/auth/permissions";

type StaffRole = "admin" | "super_admin";

// خطأ PostgREST/Postgres عند غياب العمود (قبل تطبيق migration 0007)
function isMissingPermissionsColumn(message: string) {
  return /permissions/.test(message) && /(column|schema cache)/i.test(message);
}
const MIGRATION_HINT = "يلزم تطبيق تحديث قاعدة البيانات (0007) لتفعيل الصلاحيات المخصّصة";

function readPermissions(formData: FormData): PermissionKey[] {
  return [...new Set(formData.getAll("permissions").filter(isPermissionKey))];
}

async function countSuperAdmins(admin: ReturnType<typeof createAdminClient>) {
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "super_admin");
  return count ?? 0;
}

const newStaffSchema = z.object({
  full_name: z.string().trim().min(1, "الاسم مطلوب"),
  email: z.string().trim().email("بريد إلكتروني غير صحيح"),
  phone: z.string().trim().min(6, "رقم الجوال مطلوب (بصيغة دولية)"),
  role: z.enum(["admin", "super_admin"]),
});

export async function createStaff(formData: FormData): Promise<ActionResult<AccountCredentials>> {
  return runAction(async () => {
    await assertSuperAdmin();
    const parsed = newStaffSchema.parse({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      role: formData.get("role"),
    });
    const permissions = parsed.role === "super_admin" ? [] : readPermissions(formData);
    if (parsed.role === "admin" && permissions.length === 0) throw new Error("اختر صلاحية واحدة على الأقل للإداري");

    const phone = parsed.phone.replace(/\D/g, "").replace(/^00/, "");
    const email = parsed.email.toLowerCase();
    const password = generatePassword();
    const admin = createAdminClient();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // الدور في app_metadata (لا يعدّله المستخدم)؛ user_metadata.role للتوافق مع نسخة الـ trigger القديمة
      app_metadata: { role: parsed.role },
      user_metadata: { full_name: parsed.full_name, role: parsed.role },
    });
    if (createError || !created.user) {
      if (createError?.code === "email_exists" || /already been registered/i.test(createError?.message ?? "")) {
        throw new Error("هذا البريد مسجّل مسبقاً");
      }
      throw new Error(createError?.message ?? "تعذّر إنشاء الحساب");
    }
    const userId = created.user.id;

    // نضبط الدور والصلاحيات صراحةً مهما كانت نسخة handle_new_user، ونحذف أي صف طالب أنشأه
    const [{ error: profileError }] = await Promise.all([
      admin.from("profiles").update({ role: parsed.role, phone, full_name: parsed.full_name, permissions }).eq("id", userId),
      admin.from("students").delete().eq("id", userId),
    ]);
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error(isMissingPermissionsColumn(profileError.message) ? MIGRATION_HINT : profileError.message);
    }

    revalidatePath("/admin/team");
    return { fullName: parsed.full_name, email, password, phone };
  });
}

export async function updateStaff(userId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertSuperAdmin();
    const role = z.enum(["admin", "super_admin"]).parse(formData.get("role")) as StaffRole;
    const permissions = role === "super_admin" ? [] : readPermissions(formData);
    if (role === "admin" && permissions.length === 0) throw new Error("اختر صلاحية واحدة على الأقل للإداري");

    const admin = createAdminClient();
    const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
    if (!target || target.role === "student") throw new Error("الحساب ليس من فريق الإدارة");

    if (target.role === "super_admin" && role !== "super_admin") {
      if (userId === me.id) throw new Error("لا يمكنك إزالة صلاحية المدير العام عن نفسك");
      if ((await countSuperAdmins(admin)) <= 1) throw new Error("يجب أن يبقى مدير عام واحد على الأقل");
    }

    const { error } = await admin.from("profiles").update({ role, permissions }).eq("id", userId);
    if (error) throw new Error(isMissingPermissionsColumn(error.message) ? MIGRATION_HINT : error.message);

    revalidatePath("/admin/team");
  });
}

export async function setStaffSuspended(userId: string, suspended: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertSuperAdmin();
    if (userId === me.id) throw new Error("لا يمكنك إيقاف حسابك");

    const admin = createAdminClient();
    const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
    if (!target || target.role === "student") throw new Error("الحساب ليس من فريق الإدارة");

    // الإيقاف = حظر تسجيل الدخول في Supabase Auth (قابل للتراجع، ولا يحذف أي بيانات)
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: suspended ? "876000h" : "none" });
    if (error) throw new Error(error.message);

    revalidatePath("/admin/team");
  });
}

export async function resetStaffPassword(userId: string): Promise<ActionResult<AccountCredentials>> {
  return runAction(async () => {
    await assertSuperAdmin();
    return issueNewPassword(userId, ["admin", "super_admin"]);
  });
}
