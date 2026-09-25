"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
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
import { resetStudentPassword, type CreateStudentResult } from "@/app/admin/students/actions";
import { CredentialsResult } from "@/components/admin/credentials-result";
import { unwrap } from "@/lib/unwrap";

export function ResetPasswordDialog({ studentId, studentName }: { studentId: string; studentName: string }) {
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

  function handleReset() {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await unwrap(resetStudentPassword(studentId)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline"><KeyRound /> إعادة تعيين كلمة المرور</Button>} />
      <DialogContent>
        {result ? (
          <CredentialsResult result={result} title={`كلمة مرور جديدة لـ ${result.fullName}`} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
              <DialogDescription>
                سيتم توليد كلمة مرور جديدة لـ {studentName}، وتتوقف كلمة المرور الحالية عن العمل فوراً.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button onClick={handleReset} disabled={isPending}>
                {isPending && <Spinner />}
                توليد كلمة مرور جديدة
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
