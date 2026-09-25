"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
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
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createStudent, type CreateStudentResult } from "@/app/admin/students/actions";
import { CredentialsResult } from "@/components/admin/credentials-result";
import { unwrap } from "@/lib/unwrap";

export function NewStudentDialog({ apartments }: { apartments: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CreateStudentResult | null>(null);
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
        const created = await unwrap(createStudent(formData));
        setResult(created);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button><Plus /> إضافة طالب</Button>} />
      <DialogContent>
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>إضافة طالب جديد</DialogTitle>
              <DialogDescription>راح تُنشأ له كلمة مرور تلقائياً لإرسالها له عبر واتساب</DialogDescription>
            </DialogHeader>
            <form action={handleSubmit} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="full_name">الاسم الكامل</FieldLabel>
                  <Input id="full_name" name="full_name" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">البريد الإلكتروني</FieldLabel>
                  <Input id="email" name="email" type="email" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">رقم الجوال (واتساب)</FieldLabel>
                  <Input id="phone" name="phone" placeholder="9677xxxxxxx" required />
                  <FieldDescription>بصيغة دولية بدون + أو أصفار زائدة، مثال: 9677xxxxxxx</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="apartment_id">الشقة</FieldLabel>
                  <Select name="apartment_id" items={apartments.map((a) => ({ value: a.id, label: a.name }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر الشقة (اختياري الآن)" />
                    </SelectTrigger>
                    <SelectContent>
                      {apartments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="responsive">
                  <FieldLabel htmlFor="university_name">الجامعة</FieldLabel>
                  <Input id="university_name" name="university_name" />
                </Field>
                <Field orientation="responsive">
                  <FieldLabel htmlFor="major">التخصص</FieldLabel>
                  <Input id="major" name="major" />
                </Field>
              </FieldGroup>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Spinner />}
                  إضافة الطالب
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <CredentialsResult result={result} title={`تم إنشاء حساب ${result.fullName}`} />
        )}
      </DialogContent>
    </Dialog>
  );
}
