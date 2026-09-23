import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile-form";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [
    {
      data: { user: authUser },
    },
    { data: profile },
  ] = await Promise.all([supabase.auth.getUser(), supabase.from("profiles").select("phone").eq("id", user.id).single()]);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col gap-4 p-6">
      <Link href={user.isAdmin ? "/admin" : "/app"} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> رجوع
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>الملف الشخصي</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm fullName={user.fullName} phone={profile?.phone ?? null} email={authUser?.email ?? ""} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>تغيير كلمة المرور</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
