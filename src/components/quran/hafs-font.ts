import localFont from "next/font/local";

// خط «KFGQPC Uthmanic Script HAFS» الإصدار ١٨ من مجمّع الملك فهد — داخل قارئ المصحف فقط
// (الاستثناء الوحيد من خط IBM Plex الموحّد، لأن الرسم العثماني يحتاج خطه)
export const hafsFont = localFont({
  src: "./hafs.18.woff2",
  display: "block",
  fallback: ["serif"],
});
