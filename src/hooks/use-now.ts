import { useEffect, useState } from "react";

/**
 * «الآن» يتجدد دورياً. القيمة الأولى هي لحظة السيرفر نفسها حتى لا يختلف أول رسم عن HTML القادم،
 * ثم يتبع ساعة الجهاز (الفارق ثوانٍ فقط).
 */
export function useNow(serverNowIso: string, everyMs = 20_000): Date {
  const [now, setNow] = useState(() => new Date(serverNowIso));
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
