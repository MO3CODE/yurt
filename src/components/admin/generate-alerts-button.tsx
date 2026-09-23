"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw } from "lucide-react";
import { generateAlerts } from "@/app/admin/alerts/actions";
import { toast } from "sonner";

export function GenerateAlertsButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await generateAlerts();
            toast.success("تم فحص الحالات وتحديث التنبيهات");
          } catch {
            toast.error("تعذّر تحديث التنبيهات");
          }
        })
      }
    >
      {isPending ? <Spinner /> : <RefreshCw />}
      فحص وتحديث التنبيهات
    </Button>
  );
}
