"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw } from "lucide-react";
import { generateAlerts } from "@/app/admin/alerts/actions";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";

export function GenerateAlertsButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await unwrap(generateAlerts());
            toast.success("تم فحص الحالات وتحديث التنبيهات");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "تعذّر تحديث التنبيهات");
          }
        })
      }
    >
      {isPending ? <Spinner /> : <RefreshCw />}
      فحص وتحديث التنبيهات
    </Button>
  );
}
