"use client";

import { useState, useTransition } from "react";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون ٦ أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      toast.success("تم تغيير كلمة المرور بنجاح");
      (document.getElementById("change-password-form") as HTMLFormElement | null)?.reset();
    });
  }

  return (
    <form id="change-password-form" action={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">كلمة المرور الجديدة</FieldLabel>
          <Input id="password" name="password" type="password" required autoComplete="new-password" />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm">تأكيد كلمة المرور</FieldLabel>
          <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
        </Field>
        {error && <FieldError>{error}</FieldError>}
      </FieldGroup>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending && <Spinner />}
        تغيير كلمة المرور
      </Button>
    </form>
  );
}
