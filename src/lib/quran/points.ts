import "server-only";
import type { createClient } from "@/lib/supabase/server";

/**
 * يمنح الطالب الحالي نقاط الورد والأذكار التي استحقها ولم يأخذها (الدالة في القاعدة تتحقق وتمنع التكرار).
 * لا يُفشل العملية الأصلية إن تعطّل: النقاط تُستدرك في أول استدعاء لاحق.
 */
export async function awardQuranPoints(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number> {
  const { data, error } = await supabase.rpc("award_quran_points");
  if (error) {
    console.error("award_quran_points", error.message);
    return 0;
  }
  return data ?? 0;
}
