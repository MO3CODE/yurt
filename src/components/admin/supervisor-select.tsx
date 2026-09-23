"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateApartmentSupervisor } from "@/app/admin/apartments/actions";
import { toast } from "sonner";

export function SupervisorSelect({
  apartmentId,
  currentSupervisorId,
  students,
}: {
  apartmentId: string;
  currentSupervisorId: string | null;
  students: { id: string; full_name: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string | null) {
    if (!value) return;
    startTransition(async () => {
      try {
        await updateApartmentSupervisor(apartmentId, value === "none" ? null : value);
        toast.success("تم تحديث المشرف");
      } catch {
        toast.error("تعذّر تحديث المشرف");
      }
    });
  }

  return (
    <Select defaultValue={currentSupervisorId ?? "none"} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue placeholder="اختر مشرف الشقة" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">بدون مشرف</SelectItem>
        {students.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
