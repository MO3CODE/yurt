"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** شريط رفيع يظهر فقط عند انقطاع الاتصال، ويختفي وحده عند عودته */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true // السيرفر والرسم الأول: نفترض الاتصال حتى لا يختلف الـ HTML
  );
  if (online) return null;
  return (
    <div role="status" className="sticky top-16 z-20 flex items-center justify-center gap-2 bg-warning/20 px-4 py-1.5 text-xs font-medium text-warning-foreground backdrop-blur dark:text-warning">
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      لا يوجد اتصال — ستعمل الأقسام من جديد عند عودته
    </div>
  );
}
