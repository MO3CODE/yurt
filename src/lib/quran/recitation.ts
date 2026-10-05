import type { QuranAya } from "@/lib/quran";

// ملفات صوتية لكل آية من EveryAyah.com (تلاوات مرتّلة كاملة)
export const RECITERS = [
  { id: "Husary_128kbps", name: "محمود خليل الحصري" },
  { id: "Minshawy_Murattal_128kbps", name: "محمد صديق المنشاوي" },
  { id: "Abdul_Basit_Murattal_192kbps", name: "عبد الباسط عبد الصمد" },
  { id: "Alafasy_128kbps", name: "مشاري راشد العفاسي" },
  { id: "MaherAlMuaiqly128kbps", name: "ماهر المعيقلي" },
  { id: "Abdurrahmaan_As-Sudais_192kbps", name: "عبد الرحمن السديس" },
] as const;

export type ReciterId = (typeof RECITERS)[number]["id"];
export const DEFAULT_RECITER: ReciterId = "Husary_128kbps";

export function isReciter(id: string | null): id is ReciterId {
  return RECITERS.some((r) => r.id === id);
}

export function reciterName(id: ReciterId): string {
  return RECITERS.find((r) => r.id === id)!.name;
}

export function ayahAudioUrl(reciter: ReciterId, surah: number, aya: number): string {
  return `https://everyayah.com/data/${reciter}/${String(surah).padStart(3, "0")}${String(aya).padStart(3, "0")}.mp3`;
}

export type Track = { key: string; url: string; surah: number; aya: number };

/** مقاطع الصفحة بالترتيب، مع البسملة قبل أول كل سورة (عدا الفاتحة لأنها آيتها الأولى، والتوبة) */
export function tracksFor(ayas: QuranAya[], reciter: ReciterId): Track[] {
  const out: Track[] = [];
  for (const { s, a } of ayas) {
    const key = `${s}:${a}`;
    if (a === 1 && s !== 1 && s !== 9) out.push({ key, url: ayahAudioUrl(reciter, 1, 1), surah: s, aya: a });
    out.push({ key, url: ayahAudioUrl(reciter, s, a), surah: s, aya: a });
  }
  return out;
}

/** نص الآية بلا رقمها في آخرها (للنسخ والمشاركة) */
export function ayaPlainText(t: string): string {
  return t.replace(/[\s ]*[٠-٩]+\s*$/, "").trim();
}
