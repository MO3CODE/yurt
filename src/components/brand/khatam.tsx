import { useId } from "react";
import { cn } from "@/lib/utils";

// نجمة ثمانية (خاتم) = مربّعان متراكبان بزاوية ٤٥°: ١٦ رأساً بين نصف قطر خارجي وداخلي
function starPoints(cx: number, cy: number, outer: number) {
  const inner = outer * (Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8));
  return Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

/** شعار المنصة: نجمة ثمانية بإطار ذهبي */
export function KhatamMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <polygon points={starPoints(16, 16, 15)} className="fill-gold" />
      <polygon points={starPoints(16, 16, 10.5)} className="fill-sidebar" />
      <polygon points={starPoints(16, 16, 6)} className="fill-gold" />
    </svg>
  );
}

/**
 * نقش هندسي متكرر (نجوم ثمانية وصلبان) كطبقة زخرفية.
 * اللون من currentColor، فتحكم به عبر text-* و opacity-*.
 */
export function GeometricPattern({ className, size = 56 }: { className?: string; size?: number }) {
  // معرّف آمن داخل url(#...)
  const id = "khatam" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const c = size / 2;
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-0 size-full", className)}>
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <polygon points={starPoints(c, c, size * 0.36)} fill="none" stroke="currentColor" strokeWidth="1" />
          <polygon points={starPoints(c, c, size * 0.16)} fill="currentColor" opacity="0.5" />
          {[
            [0, 0],
            [size, 0],
            [0, size],
            [size, size],
          ].map(([x, y]) => (
            <polygon key={`${x}-${y}`} points={starPoints(x, y, size * 0.14)} fill="none" stroke="currentColor" strokeWidth="1" />
          ))}
          <path
            d={`M${c} 0V${size * 0.14} M${c} ${size}V${size * 0.86} M0 ${c}H${size * 0.14} M${size} ${c}H${size * 0.86}`}
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
