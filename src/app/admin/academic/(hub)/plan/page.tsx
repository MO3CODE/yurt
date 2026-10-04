import { requirePermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { PlanBoard, type PlanItem } from "@/components/academic/plan-board";
import { todayISO } from "@/lib/date";

export default async function AcademicPlanPage() {
  await requirePermission("academic");
  const supabase = await createClient();

  const { data } = await supabase
    .from("follow_up_plan_items")
    .select("id, track, phase, title, notes, status, due_date")
    .order("sort_order")
    .order("created_at");

  return <PlanBoard items={(data ?? []) as PlanItem[]} today={todayISO()} />;
}
