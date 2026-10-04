// يجلب الجدول الرسمي (رئاسة الشؤون الدينية، إسطنبول) ويحفظه في prayer_times.
// يُشغَّل من جهازك لأن مصدر الجدول يحجب سيرفرات الاستضافة بتحدٍّ أمني:
//   npm run sync:prayer-times
// بعد انتهاء الأيام المخزّنة (~٣٢ يوماً) تعرض المنصة الأوقات المحسوبة وتوسمها «تقديرية».
import { createClient } from "@supabase/supabase-js";
import { DIYANET_URL, parseDiyanetDays } from "../src/lib/prayer-times.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("متغيّرات Supabase غير موجودة (استخدم: npm run sync:prayer-times من مجلد المشروع)");
  process.exit(1);
}

const res = await fetch(DIYANET_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
if (!res.ok) {
  console.error(`فشل الجلب: HTTP ${res.status}`);
  process.exit(1);
}
const { days, rejected } = parseDiyanetDays(await res.json());
if (days.length === 0) {
  console.error("لا أيام صالحة في الاستجابة");
  process.exit(1);
}

const admin = createClient(url, key);
const fetchedAt = new Date().toISOString();
const { error } = await admin.from("prayer_times").upsert(
  days.map((d) => ({ ...d, source: "diyanet" as const, fetched_at: fetchedAt })),
  { onConflict: "day" }
);
if (error) {
  console.error("فشل الحفظ:", error.message);
  process.exit(1);
}
console.log(`تم: ${days.length} يوماً (${days[0].day} → ${days.at(-1)!.day})، مرفوض: ${rejected}`);
