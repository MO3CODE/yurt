"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

const statusLabels: Record<string, string> = { pending: "بانتظار التنفيذ", done: "تم", missed: "لم تُنفَّذ" };
const statusVariant: Record<string, "outline" | "secondary" | "destructive"> = {
  pending: "outline",
  done: "secondary",
  missed: "destructive",
};

export function CleaningTaskRow({
  taskId,
  taskName,
  weekStartDate,
  assignment,
  students,
  onAssign,
  onStatusChange,
}: {
  taskId: string;
  taskName: string;
  weekStartDate: string;
  assignment: { id: string; student_id: string | null; status: string } | null;
  students: { id: string; full_name: string }[];
  onAssign: (taskId: string, weekStartDate: string, studentId: string) => Promise<void>;
  onStatusChange: (assignmentId: string, status: "pending" | "done" | "missed") => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleAssign(studentId: string | null) {
    if (!studentId) return;
    startTransition(async () => {
      try {
        await onAssign(taskId, weekStartDate, studentId);
      } catch {
        toast.error("تعذّر التعيين");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <span className="font-medium">{taskName}</span>
      <div className="flex items-center gap-2">
        <Select
          defaultValue={assignment?.student_id ?? undefined}
          onValueChange={handleAssign}
          disabled={isPending}
          items={students.map((s) => ({ value: s.id, label: s.full_name }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="تعيين طالب" />
          </SelectTrigger>
          <SelectContent>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {assignment && (
          <>
            <Badge variant={statusVariant[assignment.status]}>{statusLabels[assignment.status]}</Badge>
            {assignment.status === "pending" && (
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => startTransition(() => onStatusChange(assignment.id, "done"))}
                >
                  <Check className="text-success" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => startTransition(() => onStatusChange(assignment.id, "missed"))}
                >
                  <X className="text-destructive" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
