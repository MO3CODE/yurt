"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recomputeTermAction } from "@/app/admin/academic/grades-actions";
import { unwrap } from "@/lib/unwrap";

/** يعيد تحليل كل كشوف الترم المؤكَّدة بالإعدادات الحالية (الجوائز المصروفة لا تتغير) */
export function RecomputeTermButton({ termId, label = "إعادة حساب الترم" }: { termId: string; label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            const { count } = await unwrap(recomputeTermAction(termId));
            toast.success(count ? `أُعيد حساب ${count} كشف بالإعدادات الحالية` : "لا كشوف مؤكَّدة في هذا الترم بعد");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "تعذّرت إعادة الحساب");
          }
        })
      }
    >
      <RefreshCw className={isPending ? "animate-spin" : undefined} /> {label}
    </Button>
  );
}
