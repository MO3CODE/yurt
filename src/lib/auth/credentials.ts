import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePassword } from "@/lib/generate-password";
import type { AppRole } from "@/lib/supabase/types";

/** بيانات دخول تُعرض مرة واحدة للإداري ليرسلها عبر واتساب */
export type AccountCredentials = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
};

/**
 * يولّد كلمة مرور جديدة لحساب ويعيد بيانات الدخول.
 * allowedRoles يمنع تصعيد الصلاحيات: مثلاً من يملك صلاحية «الطلاب» لا يستطيع
 * إعادة تعيين كلمة مرور إداري أو المدير العام ثم الدخول بحسابه.
 */
export async function issueNewPassword(userId: string, allowedRoles: AppRole[]): Promise<AccountCredentials> {
  const admin = createAdminClient();

  const [{ data: userData, error: userError }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("full_name, phone, role").eq("id", userId).single(),
  ]);
  if (userError || !userData.user?.email || !profile) throw new Error(userError?.message ?? "الحساب غير موجود");
  if (!allowedRoles.includes(profile.role)) throw new Error("لا يمكنك إعادة تعيين كلمة مرور هذا الحساب");

  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);

  return {
    fullName: profile.full_name ?? userData.user.email,
    email: userData.user.email,
    password,
    phone: profile.phone ?? "",
  };
}
