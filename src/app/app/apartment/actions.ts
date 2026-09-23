"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";

async function requireSupervisor() {
  const user = await requireUser();
  if (!user.supervisedApartmentId) throw new Error("لست مشرفاً على أي شقة");
  return user;
}

const complaintSchema = z.object({
  status: z.enum(["new", "triaged", "in_progress", "escalated", "resolved"]),
  supervisor_response: z.string().optional(),
});

export async function updateComplaintAsSupervisor(complaintId: string, formData: FormData) {
  await requireSupervisor();
  const parsed = complaintSchema.parse({
    status: formData.get("status"),
    supervisor_response: formData.get("supervisor_response") || undefined,
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("complaints")
    .update({
      status: parsed.status,
      supervisor_response: parsed.supervisor_response,
      escalated_at: parsed.status === "escalated" ? new Date().toISOString() : null,
    })
    .eq("id", complaintId);

  if (error) throw new Error(error.message);
  revalidatePath("/app/apartment");
}

export async function setCleaningStatusAsSupervisor(assignmentId: string, status: "pending" | "done" | "missed") {
  const user = await requireSupervisor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_assignments")
    .update({ status, verified_by: user.id, verified_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/apartment");
}

export async function assignCleaningAsSupervisor(taskId: string, weekStartDate: string, studentId: string) {
  await requireSupervisor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_assignments")
    .upsert(
      { task_id: taskId, week_start_date: weekStartDate, student_id: studentId, status: "pending" },
      { onConflict: "task_id,week_start_date" }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/app/apartment");
}

const attendanceSchema = z.object({
  student_id: z.string().uuid(),
  record_date: z.string(),
  status: z.enum(["present", "absent", "excused", "late"]),
});

export async function setAttendanceAsSupervisor(formData: FormData) {
  const user = await requireSupervisor();
  const parsed = attendanceSchema.parse({
    student_id: formData.get("student_id"),
    record_date: formData.get("record_date"),
    status: formData.get("status"),
  });

  const supabase = await createClient();
  const { error } = await supabase.from("attendance_records").upsert(
    {
      student_id: parsed.student_id,
      record_date: parsed.record_date,
      status: parsed.status,
      source: "supervisor",
      approved_by: user.id,
    },
    { onConflict: "student_id,record_date" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/app/apartment");
}
