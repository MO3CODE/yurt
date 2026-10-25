"use client";

import { useEffect } from "react";
import { isMobileDevice, openWhatsApp, parseWaMe } from "@/lib/whatsapp-open";

/**
 * يلتقط النقر على أي رابط wa.me في لوحة الإدارة ويفتحه عبر openWhatsApp:
 * تبويب واتساب واحد يُعاد استخدامه، أو تطبيق واتساب على الكمبيوتر (حسب الإعداد في «تذكيرات واتساب»).
 */
export function WhatsAppLinkHandler() {
  useEffect(() => {
    if (isMobileDevice()) return;
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const target = a ? parseWaMe(a.href) : null;
      if (!target) return;
      e.preventDefault();
      openWhatsApp(target.phone, target.text);
    }
    // مرحلة الالتقاط: قبل أن يفتح المتصفح التبويب الجديد، ومع بقاء onClick الخاص بالزر (تسجيل الإرسال) يعمل
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
