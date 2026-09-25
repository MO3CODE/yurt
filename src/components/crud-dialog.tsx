"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { unwrap } from "@/lib/unwrap";
import type { ActionResult } from "@/lib/action-result";

export function CrudDialog({
  trigger,
  title,
  description,
  children,
  action,
  submitLabel = "حفظ",
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  action: (formData: FormData) => Promise<ActionResult<unknown>>;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await unwrap(action(formData));
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          {children}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
