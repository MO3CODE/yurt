"use client";

import { useTransition } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { logAttendance } from "@/app/app/attendance/actions";
import type { AttendanceStatus } from "@/lib/supabase/types";
import { toast } from "sonner";

export function AttendanceToday({ date, status }: { date: string; status?: AttendanceStatus }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(groupValue: string[]) {
    const value = groupValue[0];
    if (!value) return;
    startTransition(async () => {
      try {
        await logAttendance(date, value as AttendanceStatus);
      } catch {
        toast.error("تعذّر تسجيل الحضور");
      }
    });
  }

  return (
    <ToggleGroup value={status ? [status] : []} onValueChange={handleChange} disabled={isPending} className="flex-wrap">
      <ToggleGroupItem value="present">حاضر</ToggleGroupItem>
      <ToggleGroupItem value="late">متأخر</ToggleGroupItem>
      <ToggleGroupItem value="excused">غياب بعذر</ToggleGroupItem>
      <ToggleGroupItem value="absent">غائب</ToggleGroupItem>
    </ToggleGroup>
  );
}
