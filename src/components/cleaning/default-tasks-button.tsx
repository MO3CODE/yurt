"use client";

import { useTransition } from "react";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createDefaultCleaningTasks } from "@/app/admin/cleaning/actions";
import { unwrap } from "@/lib/unwrap";
import { toast } from "sonner";

/** يضيف المهام الأساسية لشقة بلا مهام ويوزّعها فوراً */
export function DefaultTasksButton({ apartmentId }: { apartmentId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            const count = await unwrap(createDefaultCleaningTasks(apartmentId));
            toast.success(`أُضيفت المهام الأساسية ووُزّعت ${count} مهمة`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "تعذّر إضافة المهام");
          }
        })
      }
    >
      {isPending ? <Spinner /> : <ListPlus />}
      إضافة المهام الأساسية
    </Button>
  );
}
