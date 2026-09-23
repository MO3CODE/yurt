"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { deleteScheduleEntry } from "@/app/app/schedule/actions";

export function DeleteScheduleButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="حذف"
      disabled={isPending}
      onClick={() => startTransition(() => deleteScheduleEntry(id))}
    >
      <X className="size-4" />
    </Button>
  );
}
