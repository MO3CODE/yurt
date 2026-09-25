"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/current-user";

export async function resolveAlert(alertId: string) {
  return runAction(async () => {
    const user = await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("alerts")
      .update({ resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq("id", alertId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/alerts");
  });
}

// فحص بسيط: ٣ أيام غياب متتالية، أو ٣ أيام فوّت فيها صلاة الفجر، أو حالة صحية مستمرة بلا متابعة لأكثر من ٣ أيام
export async function generateAlerts() {
  return runAction(async () => {
    await requireAdmin();
    const supabase = await createClient();

    const { data: students } = await supabase.from("students").select("id, apartment_id").eq("status", "active");
    if (!students) return;

    const { data: existing } = await supabase
      .from("alerts")
      .select("student_id, category")
      .eq("resolved", false);
    const existingKeys = new Set((existing ?? []).map((a) => `${a.student_id}:${a.category}`));

    const newAlerts: {
      student_id: string;
      apartment_id: string | null;
      category: string;
      severity: "warning" | "critical";
      message: string;
    }[] = [];

    for (const s of students) {
      const { data: lastAttendance } = await supabase
        .from("attendance_records")
        .select("status, record_date")
        .eq("student_id", s.id)
        .order("record_date", { ascending: false })
        .limit(3);

      if (
        lastAttendance?.length === 3 &&
        lastAttendance.every((r) => r.status === "absent") &&
        !existingKeys.has(`${s.id}:attendance`)
      ) {
        newAlerts.push({
          student_id: s.id,
          apartment_id: s.apartment_id,
          category: "attendance",
          severity: "critical",
          message: "غياب جامعي لثلاثة أيام متتالية",
        });
      }

      const { data: lastFajr } = await supabase
        .from("prayer_records")
        .select("status, record_date")
        .eq("student_id", s.id)
        .eq("prayer", "fajr")
        .order("record_date", { ascending: false })
        .limit(3);

      if (
        lastFajr?.length === 3 &&
        lastFajr.every((r) => r.status === "missed") &&
        !existingKeys.has(`${s.id}:prayer`)
      ) {
        newAlerts.push({
          student_id: s.id,
          apartment_id: s.apartment_id,
          category: "prayer",
          severity: "warning",
          message: "تفويت صلاة الفجر لثلاثة أيام متتالية",
        });
      }

      const { data: ongoingHealth } = await supabase
        .from("health_records")
        .select("id, start_date")
        .eq("student_id", s.id)
        .eq("status", "ongoing");

      for (const h of ongoingHealth ?? []) {
        const days = (Date.now() - new Date(h.start_date).getTime()) / 86_400_000;
        if (days >= 3 && !existingKeys.has(`${s.id}:health`)) {
          newAlerts.push({
            student_id: s.id,
            apartment_id: s.apartment_id,
            category: "health",
            severity: "warning",
            message: "حالة صحية مستمرة منذ ٣ أيام أو أكثر بدون تعافٍ",
          });
          existingKeys.add(`${s.id}:health`);
        }
      }
    }

    if (newAlerts.length > 0) {
      const { error } = await supabase.from("alerts").insert(newAlerts);
      if (error) throw new Error(error.message);
    }

    revalidatePath("/admin/alerts");
  });
}
