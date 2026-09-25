"use client";

import { useTransition } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setAttendanceAsSupervisor } from "@/app/app/apartment/actions";
import type { AttendanceStatus } from "@/lib/supabase/types";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";

export function SupervisorAttendanceRow({
  studentId,
  studentName,
  date,
  status,
}: {
  studentId: string;
  studentName: string;
  date: string;
  status?: AttendanceStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(groupValue: string[]) {
    const value = groupValue[0];
    if (!value) return;
    const formData = new FormData();
    formData.set("student_id", studentId);
    formData.set("record_date", date);
    formData.set("status", value);
    startTransition(async () => {
      try {
        await unwrap(setAttendanceAsSupervisor(formData));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر التسجيل");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
      <span className="font-medium">{studentName}</span>
      <ToggleGroup value={status ? [status] : []} onValueChange={handleChange} disabled={isPending}>
        <ToggleGroupItem value="present">حاضر</ToggleGroupItem>
        <ToggleGroupItem value="late">متأخر</ToggleGroupItem>
        <ToggleGroupItem value="excused">بعذر</ToggleGroupItem>
        <ToggleGroupItem value="absent">غائب</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
