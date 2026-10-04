import "server-only";
import webpush from "web-push";

// هوية السيرفر أمام خدمات الإشعارات (Google/Apple/Mozilla): رابط الموقع لا بريد شخصي
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_SITE_URL || "https://yurt-tau.vercel.app";

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (configured = false);
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
  return (configured = true);
}

export type PushTarget = { id: string; endpoint: string; p256dh: string; auth_key: string };
export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type PushResult = { sent: number; failed: number; goneIds: string[] };

/**
 * يرسل الإشعار لكل اشتراك. الاشتراك المنتهي (404/410) يُرجَع معرّفه ليُحذف؛
 * أي خطأ آخر (شبكة/خدمة مؤقتاً) يُعدّ فشلاً قابلاً لإعادة المحاولة.
 * ttl: مدة صلاحية الإشعار بالثواني — تذكير الصلاة لا قيمة له بعد دقائق فلا يُسلَّم متأخراً.
 */
export async function sendPush(targets: PushTarget[], payload: PushPayload, ttl = 600): Promise<PushResult> {
  if (!pushConfigured()) return { sent: 0, failed: targets.length, goneIds: [] };

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    targets.map((t) =>
      webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth_key } }, body, {
        TTL: ttl,
        urgency: "high",
      })
    )
  );

  const out: PushResult = { sent: 0, failed: 0, goneIds: [] };
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out.sent++;
    else {
      const code = (r.reason as { statusCode?: number } | undefined)?.statusCode;
      if (code === 404 || code === 410) out.goneIds.push(targets[i].id);
      else out.failed++;
    }
  });
  return out;
}
