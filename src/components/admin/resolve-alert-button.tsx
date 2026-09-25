"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { resolveAlert } from "@/app/admin/alerts/actions";
import { toastOnError } from "@/lib/unwrap";

export function ResolveAlertButton({ alertId }: { alertId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => startTransition(async () => { await toastOnError(resolveAlert(alertId)); })}>
      <Check /> تمت المعالجة
    </Button>
  );
}
