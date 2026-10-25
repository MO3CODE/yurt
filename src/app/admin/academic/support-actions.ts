"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// طلبات الدعم الأكاديمي والمدرّسون الخصوصيون وجلساتهم — صلاحية academic

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح");

function refresh() {
  revalidatePath("/admin/academic", "layout");
  revalidatePath("/app/academic-support");
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function tutorName(db: Db, tutorId: string | null) {
  if (!tutorId) return null;
  const { data } = await db.from("academic_tutors").select("full_name").eq("id", tutorId).single();
  return data?.full_name ?? null;
}

const requestSchema = z.object({
  id: uuid,
  status: z.enum(["open", "assigned", "in_progress", "resolved", "closed"]),
  priority: z.enum(["urgent", "high", "medium"]).nullable(),
  tutorId: uuid.nullable(),
  notes: z.string().trim().max(2000),
});

/** تحديث طلب: الحالة والأولوية والمدرّس والملاحظات (الإغلاق يحتاج سبباً) */
export async function updateSupportRequest(input: z.input<typeof requestSchema>) {
  return runAction(async () => {
    await assertPermission("academic");
    const v = requestSchema.parse(input);
    if (v.status === "closed" && v.notes.length < 3) throw new Error("اكتب سبب الرفض أو الإلغاء في الملاحظات");
    const supabase = await createClient();
    const name = await tutorName(supabase, v.tutorId);
    const { error } = await supabase
      .from("academic_support_requests")
      .update({
        status: v.tutorId && v.status === "open" ? "assigned" : v.status,
        priority: v.priority,
        tutor_id: v.tutorId,
        // الطالب يرى اسم المتابع لا جدول المدرّسين
        assigned_to_name: name,
        admin_notes: v.notes || null,
        resolved_at: v.status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", v.id);
    if (error) throw new Error(error.message);
    refresh();
  });
}

/** مجموعة تقوية: مدرّس واحد لكل طلاب المادة المفتوحة */
export async function assignGroup(input: { ids: string[]; tutorId: string }) {
  return runAction(async () => {
    await assertPermission("academic");
    const v = z.object({ ids: z.array(uuid).min(2), tutorId: uuid }).parse(input);
    const supabase = await createClient();
    const name = await tutorName(supabase, v.tutorId);
    const { error } = await supabase
      .from("academic_support_requests")
      .update({ tutor_id: v.tutorId, assigned_to_name: name, status: "assigned" })
      .in("id", v.ids)
      .in("status", ["open", "assigned"]);
    if (error) throw new Error(error.message);
    refresh();
  });
}

const sessionSchema = z.object({
  requestIds: z.array(uuid).min(1),
  tutorId: uuid.nullable(),
  date: isoDate,
  hours: z.number().positive("المدة بالساعات").max(12),
  attended: z.boolean(),
  cost: z.number().min(0).nullable(),
  note: z.string().trim().max(1000),
});

/** تسجيل جلسة (لطالب أو لمجموعة؛ تكلفة جلسة المجموعة تُقسم على طلابها) */
export async function addTutoringSession(input: z.input<typeof sessionSchema>) {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = sessionSchema.parse(input);
    const supabase = await createClient();
    const share = v.cost === null ? null : Math.round((v.cost / v.requestIds.length) * 100) / 100;
    const { error } = await supabase.from("academic_tutoring_sessions").insert(
      v.requestIds.map((id) => ({
        request_id: id,
        tutor_id: v.tutorId,
        session_date: v.date,
        duration_hours: v.hours,
        attended: v.attended,
        cost: share,
        note: v.note || null,
        created_by: user.id,
      }))
    );
    if (error) throw new Error(error.message);
    // أول جلسة تجعل الطلب «قيد المتابعة»
    await supabase.from("academic_support_requests").update({ status: "in_progress" }).in("id", v.requestIds).in("status", ["open", "assigned"]);
    refresh();
  });
}

export async function deleteTutoringSession(id: string) {
  return runAction(async () => {
    await assertPermission("academic");
    const supabase = await createClient();
    const { error } = await supabase.from("academic_tutoring_sessions").delete().eq("id", uuid.parse(id));
    if (error) throw new Error(error.message);
    refresh();
  });
}

const tutorSchema = z.object({
  id: uuid.nullable(),
  fullName: z.string().trim().min(2, "اكتب اسم المدرّس").max(80),
  phone: z.string().trim().max(30),
  subjects: z.array(z.string().trim().min(1).max(80)).max(20),
  hourlyRate: z.number().min(0).nullable(),
  currency: z.string().trim().min(3).max(5),
  rating: z.number().min(0).max(5).nullable(),
  notes: z.string().trim().max(1000),
  isActive: z.boolean(),
});

export async function saveTutor(input: z.input<typeof tutorSchema>) {
  return runAction(async () => {
    await assertPermission("academic");
    const v = tutorSchema.parse(input);
    const supabase = await createClient();
    const row = {
      full_name: v.fullName,
      phone: v.phone || null,
      subjects: v.subjects,
      hourly_rate: v.hourlyRate,
      currency: v.currency.toUpperCase(),
      rating: v.rating,
      notes: v.notes || null,
      is_active: v.isActive,
    };
    const { error } = v.id ? await supabase.from("academic_tutors").update(row).eq("id", v.id) : await supabase.from("academic_tutors").insert(row);
    if (error) throw new Error(error.message);
    refresh();
  });
}
