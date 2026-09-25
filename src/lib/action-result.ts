import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

// في الإنتاج يُخفي Next.js رسالة أي خطأ يُرمى من Server Action ويعرض رسالة عامة،
// لذلك تُرجع الـ actions النتيجة كقيمة بدل رمي الخطأ حتى تصل الرسالة العربية للمستخدم.
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

function toMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "بيانات غير صالحة";
  if (e instanceof Error && e.message) return e.message;
  return "حدث خطأ غير متوقع";
}

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    unstable_rethrow(e); // redirect() / notFound() يجب أن تمرّ كما هي
    console.error(e);
    return { ok: false, error: toMessage(e) };
  }
}

