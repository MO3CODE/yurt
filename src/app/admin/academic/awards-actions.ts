"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح");

function refresh() {
  revalidatePath("/admin/academic", "layout");
  revalidatePath("/app/grades");
}

/** اعتماد جوائز مستحقة (كلها في الترم، أو المحددة) */
export async function approveAwards(input: { termId: string; ids?: string[] }) {
  return runAction(async () => {
    const user = await assertPermission("academic");
    const v = z.object({ termId: z.string().uuid(), ids: z.array(z.string().uuid()).optional() }).parse(input);
    const supabase = await createClient();
    let q = supabase
      .from("academic_awards")
      .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("term_id", v.termId)
      .eq("status", "eligible");
    if (v.ids?.length) q = q.in("id", v.ids);
    const { data, error } = await q.select("id");
    if (error) throw new Error(error.message);
    refresh();
    return { count: data?.length ?? 0 };
  });
}

const paySchema = z.object({
  id: z.string().uuid(),
  paidAt: isoDate,
  method: z.string().trim().min(2, "اكتب طريقة الدفع").max(60),
  ref: z.string().trim().max(120),
});

/** تسجيل صرف جائزة معتمدة — بعده لا تتغير */
export async function markAwardPaid(input: z.input<typeof paySchema>) {
  return runAction(async () => {
    await assertPermission("academic");
    const v = paySchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academic_awards")
      .update({ status: "paid", paid_at: v.paidAt, payment_method: v.method, payment_ref: v.ref || null })
      .eq("id", v.id)
      .eq("status", "approved")
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("اعتمد الجائزة أولاً قبل تسجيل صرفها");
    refresh();
  });
}

/** إلغاء جائزة غير مصروفة (تبقى ملغاة ولو أُعيد الحساب)، أو استرجاعها */
export async function setAwardCancelled(id: string, cancelled: boolean) {
  return runAction(async () => {
    await assertPermission("academic");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academic_awards")
      .update(cancelled ? { status: "cancelled" } : { status: "eligible", approved_by: null, approved_at: null })
      .eq("id", z.string().uuid().parse(id))
      .in("status", cancelled ? ["eligible", "approved"] : ["cancelled"])
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("لا يمكن تغيير هذه الجائزة");
    refresh();
  });
}
