"use client";

import { useTransition } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { updateProfile } from "@/app/profile/actions";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string | null; email: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await unwrap(updateProfile(formData));
        toast.success("تم حفظ التغييرات");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">البريد الإلكتروني</FieldLabel>
          <Input id="email" value={email} disabled />
        </Field>
        <Field>
          <FieldLabel htmlFor="full_name">الاسم الكامل</FieldLabel>
          <Input id="full_name" name="full_name" defaultValue={fullName} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="phone">رقم الجوال</FieldLabel>
          <Input id="phone" name="phone" defaultValue={phone ?? ""} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending && <Spinner />}
        حفظ
      </Button>
    </form>
  );
}
