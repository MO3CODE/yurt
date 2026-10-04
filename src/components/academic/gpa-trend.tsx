/** خط تطوّر المعدل عبر الجلسات (الأقدم يميناً — اتجاه القراءة العربي) */
export function GpaTrend({ points }: { points: { label: string; ratio: number; text: string }[] }) {
  if (points.length < 2) return null;

  const w = 240;
  const h = 64;
  const pad = 8;
  const ratios = points.map((p) => p.ratio);
  let lo = Math.min(...ratios);
  let hi = Math.max(...ratios);
  if (hi - lo < 0.1) {
    const mid = (hi + lo) / 2;
    lo = mid - 0.05;
    hi = mid + 0.05;
  }
  const step = (w - 2 * pad) / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: w - pad - i * step,
    y: h - pad - ((p.ratio - lo) / (hi - lo)) * (h - 2 * pad),
    ...p,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const improving = points[points.length - 1].ratio >= points[0].ratio;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`تطوّر المعدل عبر ${points.length} جلسات`}
      className={improving ? "h-16 w-full text-success" : "h-16 w-full text-destructive"}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4.5 : 3} fill="var(--card)" stroke="currentColor" strokeWidth="2" />
          <title>{`${c.label}: ${c.text}`}</title>
        </g>
      ))}
    </svg>
  );
}
