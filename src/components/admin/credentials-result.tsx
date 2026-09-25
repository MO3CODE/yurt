"use client";

import { useState } from "react";
import { MessageCircle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CreateStudentResult } from "@/app/admin/students/actions";
import { buildCredentialsMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { toast } from "sonner";

// شاشة بيانات الدخول بعد إنشاء حساب أو إعادة تعيين كلمة المرور
export function CredentialsResult({ result, title }: { result: CreateStudentResult; title: string }) {
  const [copied, setCopied] = useState(false);

  const message = buildCredentialsMessage({
    fullName: result.fullName,
    email: result.email,
    password: result.password,
    loginUrl: typeof window !== "undefined" ? window.location.origin + "/login" : "",
  });

  function handleCopy() {
    navigator.clipboard.writeText(message).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("تعذّر النسخ — انسخ البيانات يدوياً")
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>أرسل له بيانات الدخول عبر واتساب — كلمة المرور هذه لن تظهر مرة أخرى</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">اسم المستخدم</span>
          <span className="truncate font-medium" dir="ltr">{result.email}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">كلمة المرور</span>
          <span className="font-mono font-medium" dir="ltr">{result.password}</span>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={handleCopy}>
          {copied ? <Check className="text-success" /> : <Copy />}
          نسخ الرسالة
        </Button>
        {result.phone ? (
          <Button
            nativeButton={false}
            render={<a href={buildWhatsAppLink(result.phone, message)} target="_blank" rel="noopener noreferrer" />}
            onClick={() => toast.success("فُتح واتساب — راجع الرسالة قبل الإرسال")}
          >
            <MessageCircle /> إرسال عبر واتساب
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
