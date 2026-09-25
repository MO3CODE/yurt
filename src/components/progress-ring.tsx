import { cn } from "@/lib/utils";

/** حلقة تقدّم SVG تمتلئ بحركة عند الظهور؛ value من 0 إلى max */
export function ProgressRing({
  value,
  max = 100,
  size = 72,
  stroke = 7,
  className,
  trackClassName = "text-muted",
  boxClassName,
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  className?: string;
  trackClassName?: string;
  /** لتحديد الحجم بأصناف CSS (مثل size-24 md:size-32) بدل size الثابت */
  boxClassName?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  return (
    <div
      className={cn("relative inline-grid shrink-0 place-items-center", boxClassName)}
      style={boxClassName ? undefined : { width: size, height: size }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" className={trackClassName} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          strokeLinecap="round"
          className={cn("text-primary transition-[stroke-dashoffset] duration-700 ease-out", className)}
          style={
            {
              strokeDasharray: circumference,
              strokeDashoffset: circumference * (1 - ratio),
              "--ring-circumference": `${circumference}`,
              animation: "ring-fill 1.1s var(--ease-out-soft) both",
            } as React.CSSProperties
          }
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}
