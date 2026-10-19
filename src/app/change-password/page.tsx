import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForcedForm } from "./change-password-form";

export const metadata = { title: "تعيين كلمة مرور جديدة" };

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // من لا يحتاج التغيير يعود للمنصة
  if (user.app_metadata?.must_change_password !== true) redirect("/");

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </span>
          <CardTitle className="font-heading text-2xl">اختر كلمة مرور خاصة بك</CardTitle>
          <CardDescription>كلمة المرور الحالية مؤقتة وأُرسلت إليك من الإدارة. اختر كلمة مرور جديدة لا يعرفها غيرك لتبدأ استخدام المنصة.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForcedForm />
        </CardContent>
      </Card>
    </main>
  );
}
