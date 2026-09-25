import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

// على الواجهة: يحوّل نتيجة الـ Server Action إلى قيمة، أو خطأ يحمل رسالته الحقيقية
export async function unwrap<T>(result: Promise<ActionResult<T>>): Promise<T> {
  const r = await result;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

// للأزرار البسيطة: ينفّذ الـ action ويعرض رسالة الخطأ (إن وُجدت) كـ toast
export async function toastOnError<T>(result: Promise<ActionResult<T>>): Promise<boolean> {
  const r = await result;
  if (!r.ok) toast.error(r.error);
  return r.ok;
}
