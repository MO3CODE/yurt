// فتح محادثة واتساب من المتصفح دون تكديس التبويبات.
// رابط wa.me في تبويب جديد يفتح صفحة واتساب ويب جديدة كل مرة، ولا يستطيع موقعنا التحكم بتبويب واتساب فتحه المستخدم بنفسه.
// الحل: كل الرسائل تُفتح في تبويب واحد مسمّى يُعاد استخدامه، أو في تطبيق واتساب على الكمبيوتر مباشرة.

export type WhatsAppMode = "web" | "app";

const MODE_KEY = "yurt-whatsapp-mode";
const TAB_NAME = "yurt-whatsapp";

export function getWhatsAppMode(): WhatsAppMode {
  try {
    return localStorage.getItem(MODE_KEY) === "app" ? "app" : "web";
  } catch {
    return "web";
  }
}

export function setWhatsAppMode(mode: WhatsAppMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // التخزين غير متاح (تصفح خاص): يبقى الافتراضي
  }
}

/** الجوال يفتح تطبيق واتساب من رابط wa.me بنفسه، فلا نتدخل */
export const isMobileDevice = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

/** https://wa.me/905551234567?text=... ← الرقم والنص */
export function parseWaMe(href: string): { phone: string; text: string } | null {
  try {
    const url = new URL(href);
    if (url.hostname !== "wa.me" && url.hostname !== "api.whatsapp.com") return null;
    const phone = (url.pathname.replace(/\//g, "") || url.searchParams.get("phone") || "").replace(/\D/g, "");
    return phone ? { phone, text: url.searchParams.get("text") ?? "" } : null;
  } catch {
    return null;
  }
}

export function openWhatsApp(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const query = `phone=${digits}&text=${encodeURIComponent(text)}`;
  if (isMobileDevice()) {
    window.location.href = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
    return;
  }
  if (getWhatsAppMode() === "app") {
    // تطبيق واتساب على الكمبيوتر يفتح المحادثة مباشرة بلا تبويب
    window.location.href = `whatsapp://send?${query}`;
    return;
  }
  // نفس التبويب كل مرة (بالاسم)، فلا تتكدس صفحات واتساب ويب
  const tab = window.open(`https://web.whatsapp.com/send?${query}`, TAB_NAME);
  if (tab) {
    tab.opener = null;
    tab.focus();
  }
}
