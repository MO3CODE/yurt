"use client";

import { useEffect, useRef, useState } from "react";

/** عدّاد يصعد إلى القيمة عند الظهور (فوري عند تفضيل تقليل الحركة) */
export function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  // آخر قيمة معروضة فعلاً — نبدأ منها أي حركة جديدة (يصمد أمام تشغيل الـ effect مرتين)
  const shownRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reduce ? 0 : duration;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = total === 0 ? 1 : Math.min(1, (now - start) / total);
      const eased = 1 - Math.pow(1 - t, 3);
      shownRef.current = Math.round(from + (value - from) * eased);
      setDisplay(shownRef.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="tabular-nums">{display.toLocaleString("en-US")}</span>;
}
