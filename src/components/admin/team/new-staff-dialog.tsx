"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createStaff } from "@/app/admin/team/actions";
import { CredentialsResult } from "@/components/admin/credentials-result";
import { PermissionPicker } from "@/components/admin/team/permission-picker";
import type { AccountCredentials } from "@/lib/auth/credentials";
import { unwrap } from "@/lib/unwrap";

export function NewStaffDialog() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AccountCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setResult(null);
      setError(null);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await unwrap(createStaff(formData)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button><UserPlus /> إضافة إداري</Button>} />
      <DialogContent className="sm:max-w-xl">
        {result ? (
          <CredentialsResult result={result} title={`تم إنشاء حساب ${result.fullName}`} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>إضافة عضو لفريق الإدارة</DialogTitle>
              <DialogDescription>تُنشأ له كلمة مرور تلقائياً لترسلها عبر واتساب، ويرى فقط الأقسام التي تختارها</DialogDescription>
            </DialogHeader>
            <form action={handleSubmit} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="staff_full_name">الاسم الكامل</FieldLabel>
                  <Input id="staff_full_name" name="full_name" required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="staff_email">البريد الإلكتروني</FieldLabel>
                    <Input id="staff_email" name="email" type="email" dir="ltr" className="text-start" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="staff_phone">رقم الجوال (واتساب)</FieldLabel>
                    <Input id="staff_phone" name="phone" dir="ltr" className="text-start" placeholder="905xxxxxxxxx" required />
                    <FieldDescription>بصيغة دولية</FieldDescription>
                  </Field>
                </div>
              </FieldGroup>
              <PermissionPicker />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Spinner />}
                  إنشاء الحساب
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
