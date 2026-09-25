"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 45_000; // تحديث دوري أثناء ظهور الصفحة
const FOCUS_GAP_MS = 10_000; // أقل فاصل بين تحديثين عند العودة للتبويب
const DEBOUNCE_MS = 700; // تجميع التغييرات المتتالية في تحديث واحد

/**
 * يُبقي بيانات الصفحة متزامنة بين الطالب والإدارة:
 * - فوري: اشتراك Supabase Realtime على الجداول المعنية (يعمل متى فُعّلت في قاعدة البيانات؛
 *   RLS تضمن أن كل مستخدم يستقبل تغييرات ما يحق له رؤيته فقط).
 * - احتياطي: تحديث عند العودة للتبويب، وكل ٤٥ ثانية طالما الصفحة ظاهرة.
 * router.refresh() يعيد جلب مكوّنات السيرفر دون فقدان حالة الواجهة.
 */
export function LiveSync({ tables }: { tables: string[] }) {
  const router = useRouter();
  const lastRefresh = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tablesKey = tables.join(",");

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== "visible") return;
      lastRefresh.current = Date.now();
      router.refresh();
    }

    function scheduleRefresh() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refresh, DEBOUNCE_MS);
    }

    function onVisible() {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > FOCUS_GAP_MS) refresh();
    }

    const interval = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const supabase = createClient();
    const channel = supabase.channel(`live-sync:${tablesKey}`);
    for (const table of tablesKey.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
    }
    channel.subscribe();

    return () => {
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      supabase.removeChannel(channel);
    };
  }, [router, tablesKey]);

  return null;
}
