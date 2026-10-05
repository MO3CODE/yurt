/** تصغير صورة في المتصفح قبل الرفع (أطول ضلع maxSide بكسل، JPEG) */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("تعذّر تجهيز الصورة"))), "image/jpeg", quality)
  );
}

/** رسالة عربية واضحة لأخطاء رفع Supabase Storage */
export function uploadErrorMessage(message: string): string {
  if (message.includes("row-level security")) return "انتهت جلستك أو لا تملك صلاحية الرفع، أعد تسجيل الدخول ثم حاول";
  if (/payload too large|exceeded the maximum/i.test(message)) return "الملف أكبر من الحد المسموح";
  return `تعذّر رفع الملف: ${message}`;
}
