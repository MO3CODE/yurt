"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ChangePasswordState = { error?: string };

export async function changeTemporaryPassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "كلمة المرور يجب أن تكون ٨ أحرف على الأقل" };
  if (/^\d+$/.test(password)) return { error: "أضف حروفاً إلى كلمة المرور، فالأرقام وحدها ضعيفة" };
  if (password !== confirm) return { error: "كلمتا المرور غير متطابقتين" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "اختر كلمة مرور مختلفة عن المؤقتة" };
    if (error.code === "weak_password") return { error: "كلمة المرور ضعيفة أو شائعة، اختر غيرها" };
    return { error: "تعذّر تغيير كلمة المرور، حاول مرة أخرى" };
  }

  // العلامة في app_metadata فلا يستطيع المستخدم إزالتها بنفسه؛ تُزال هنا بعد نجاح التغيير فقط
  const { error: flagError } = await createAdminClient().auth.admin.updateUserById(user.id, {
    app_metadata: { must_change_password: false },
  });
  if (flagError) return { error: "تغيّرت كلمة المرور لكن تعذّر إكمال التفعيل، سجّل الدخول بها من جديد" };

  redirect("/");
}
