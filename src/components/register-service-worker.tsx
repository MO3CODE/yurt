"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      // updateViaCache: none لتصل تحديثات عامل الخدمة (ومنها الإصلاحات الأمنية) فور نشرها
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => {});
    }
  }, []);

  return null;
}
