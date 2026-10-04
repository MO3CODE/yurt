import { starPoints } from "@/components/brand/khatam";

// ألوان الشعار كما في الواجهة (--sidebar و --sidebar-primary) مقيسة إلى hex لأن ImageResponse لا يقرأ oklch
const EMERALD_TOP = "#0b3f3b";
const EMERALD_BOTTOM = "#021f1d";
const GOLD = "#dba751";

/**
 * أيقونة التطبيق (تبويب المتصفح + الشاشة الرئيسية): نجمة ثمانية ذهبية على الزمرّد.
 * الخلفية بلا زوايا مدوّرة (النظام يقصّها بنفسه، وهذا يناسب maskable)، والنجمة داخل المنطقة الآمنة (قطرها ٨٠٪ من الوسط).
 */
export function khatamIconElement(px: number) {
  const c = px / 2;
  const outer = px * 0.4;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(160deg, ${EMERALD_TOP} 0%, ${EMERALD_BOTTOM} 100%)`,
      }}
    >
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`}>
        <polygon points={starPoints(c, c, outer)} fill={GOLD} />
        <polygon points={starPoints(c, c, outer * 0.7)} fill={EMERALD_TOP} />
        <polygon points={starPoints(c, c, outer * 0.4)} fill={GOLD} />
      </svg>
    </div>
  );
}
