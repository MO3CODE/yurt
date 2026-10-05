// يبني أذكار الصباح والمساء (حصن المسلم) من بيانات Seen-Arabic المفتوحة (رخصة MIT)
// مع تصحيح أخطاء إملائية وجدناها، واستبدال الآيات بنص مجمّع الملك فهد من صفحات المصحف عندنا.
// التشغيل: npm run build:adhkar  (بعد npm run build:quran؛ الناتج يُرفع مع المشروع)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const DATA_URL = "https://raw.githubusercontent.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB/main/ar.json";

type Source = { order: number; content: string; count: number; fadl: string; source: string; type: 0 | 1 | 2 };
type Aya = { s: number; a: number; t: string };

const root = process.cwd();
const outFile = path.join(root, "src/lib/adhkar/adhkar.json");

// تصحيحات على النص كما ورد في حصن المسلم
const TEXT_FIXES: Record<number, (t: string) => string> = {
  7: (t) => t.replaceAll("الْملْكُ", "الْمُلْكُ"),
  24: () =>
    "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ رَبِّ الْعَالَمِينَ، اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذِهِ اللَّيْلَةِ: فَتْحَهَا، وَنَصْرَهَا، وَنُورَهَا، وَبَرَكَتَهَا، وَهُدَاهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِيهَا وَشَرِّ مَا بَعْدَهَا",
  // «نَبَيِّنَا» ← «نَبِيِّنَا» (فتحة الباء كسرة؛ بالرموز لأن ترتيب الشدّة والكسرة يختلف بين المصادر)
  29: (t) => t.replace("نَبَي", "نَبِي"),
};

// الأذكار القرآنية: نص المجمّع بدل نص المصدر
const ISTIADHA = "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ";
const QURAN: Record<number, { intro: string | null; title: string; refs: [surah: number, from: number, to: number] }> = {
  2: { intro: ISTIADHA, title: "آية الكرسي — البقرة ٢٥٥", refs: [2, 255, 255] },
  3: { intro: ISTIADHA, title: "خواتيم البقرة — ٢٨٥–٢٨٦", refs: [2, 285, 286] },
  4: { intro: null, title: "سورة الإخلاص", refs: [112, 1, 4] },
  5: { intro: null, title: "سورة الفلق", refs: [113, 1, 5] },
  6: { intro: null, title: "سورة الناس", refs: [114, 1, 6] },
};

async function loadAyas(): Promise<Map<string, Aya>> {
  const map = new Map<string, Aya>();
  for (const page of [42, 49, 604]) {
    const file = path.join(root, `public/quran/pages/${String(page).padStart(3, "0")}.json`);
    const { ayas } = JSON.parse(await readFile(file, "utf8")) as { ayas: Aya[] };
    for (const a of ayas) map.set(`${a.s}:${a.a}`, a);
  }
  return map;
}

const PERIOD = { 0: "both", 1: "morning", 2: "evening" } as const;

async function main() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`تعذّر تنزيل الأذكار: HTTP ${res.status}`);
  const rows = (await res.json()) as Source[];
  if (rows.length !== 34) throw new Error(`عدد الأذكار ${rows.length} بدل 34 — راجع المصدر قبل النشر`);

  const ayas = await loadAyas();
  const out = rows
    .sort((a, b) => a.order - b.order)
    .map((r) => {
      const q = QURAN[r.order];
      const quran = q
        ? {
            intro: q.intro,
            title: q.title,
            basmala: q.refs[0] !== 2,
            ayas: Array.from({ length: q.refs[2] - q.refs[1] + 1 }, (_, i) => {
              const aya = ayas.get(`${q.refs[0]}:${q.refs[1] + i}`);
              if (!aya) throw new Error(`الآية ${q.refs[0]}:${q.refs[1] + i} غير موجودة في صفحات المصحف`);
              return aya;
            }),
          }
        : null;
      return {
        id: r.order,
        period: PERIOD[r.type],
        count: r.count,
        text: quran ? null : (TEXT_FIXES[r.order]?.(r.content) ?? r.content).replace(/\s+/g, " ").trim(),
        quran,
        // «[سورة البقرة، الآية: 255]» مكرر مع عنوان الآية فنحذفه
        fadl: r.fadl.replace(/^\[[^\]]*\]\s*/, "").trim() || null,
        source: r.source.replace(/\s+/g, " ").trim() || null,
      };
    });

  const morning = out.filter((d) => d.period !== "evening").length;
  const evening = out.filter((d) => d.period !== "morning").length;
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(out));
  console.log(`تم: ${out.length} ذكراً (الصباح ${morning}، المساء ${evening}).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
