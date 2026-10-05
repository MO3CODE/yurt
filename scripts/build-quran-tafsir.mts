// يبني ملفات التفسير الميسّر (مجمّع الملك فهد) لكل صفحة من صفحات المصحف، عبر Tanzil.net
// التشغيل: npm run build:tafsir  (بعد npm run build:quran؛ الناتج يُرفع مع المشروع)
// شرط Tanzil: النص يُنقل كما هو، مع ذكر المصدر، ولغير الأغراض التجارية.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const URL_TXT = "https://tanzil.net/trans/?transID=ar.muyassar&type=txt-2";
const root = process.cwd();
const outDir = path.join(root, "public/quran/tafsir");

async function main() {
  const res = await fetch(URL_TXT);
  if (!res.ok) throw new Error(`تعذّر تنزيل التفسير: HTTP ${res.status}`);
  const lines = (await res.text()).split("\n").filter((l) => /^\d+\|\d+\|/.test(l));
  if (lines.length !== 6236) throw new Error(`عدد الآيات ${lines.length} بدل 6236`);

  const tafsir = new Map<string, string>();
  for (const l of lines) {
    const [s, a, ...rest] = l.split("|");
    tafsir.set(`${s}:${a}`, rest.join("|").trim());
  }

  await mkdir(outDir, { recursive: true });
  for (let p = 1; p <= 604; p++) {
    const name = `${String(p).padStart(3, "0")}.json`;
    const { ayas } = JSON.parse(await readFile(path.join(root, "public/quran/pages", name), "utf8")) as {
      ayas: { s: number; a: number }[];
    };
    const out: Record<string, string> = {};
    for (const { s, a } of ayas) {
      const t = tafsir.get(`${s}:${a}`);
      if (!t) throw new Error(`لا تفسير للآية ${s}:${a}`);
      out[`${s}:${a}`] = t;
    }
    await writeFile(path.join(outDir, name), JSON.stringify(out));
  }
  console.log("تم: التفسير الميسّر لـ 604 صفحة (6236 آية).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
