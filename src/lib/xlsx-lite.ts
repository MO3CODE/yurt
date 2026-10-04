// قراءة أول ورقة من ملف .xlsx في المتصفح (نصوص وأرقام فقط) دون مكتبة جداول ثقيلة.
// ملف xlsx هو أرشيف zip فيه XML: sharedStrings للنصوص، وworksheets للخلايا.
import { unzipSync, strFromU8 } from "fflate";

const MAX_BYTES = 5 * 1024 * 1024;

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

/** «C5» → 2 (فهرس العمود من الصفر) */
function columnIndex(ref: string): number {
  const letters = ref.replace(/[^A-Za-z]/g, "").toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function textOf(el: Element): string {
  // <t> مباشرة أو داخل <r> (نص منسّق)؛ نتجاهل نطق الأحرف الصوتي <rPh>
  return Array.from(el.getElementsByTagName("t"))
    .filter((t) => t.parentElement?.localName !== "rPh")
    .map((t) => t.textContent ?? "")
    .join("");
}

export async function readXlsx(file: File): Promise<string[][]> {
  if (file.size > MAX_BYTES) throw new Error("الملف كبير جداً (الحد ٥ ميغابايت)");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("تعذّرت قراءة الملف — تأكد أنه بصيغة .xlsx (وليس .xls القديمة)");
  }

  const read = (path: string) => (files[path] ? strFromU8(files[path]) : null);

  // أول ورقة بحسب الترتيب في الكتاب
  const workbook = read("xl/workbook.xml");
  const rels = read("xl/_rels/workbook.xml.rels");
  let sheetPath = "xl/worksheets/sheet1.xml";
  if (workbook && rels) {
    const firstSheet = parseXml(workbook).getElementsByTagName("sheet")[0];
    const rid = firstSheet?.getAttribute("r:id");
    const rel = Array.from(parseXml(rels).getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rid);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const sheetXml = read(sheetPath);
  if (!sheetXml) throw new Error("لم أجد ورقة بيانات في الملف");

  const sharedXml = read("xl/sharedStrings.xml");
  const shared = sharedXml ? Array.from(parseXml(sharedXml).getElementsByTagName("si")).map(textOf) : [];

  const matrix: string[][] = [];
  for (const rowEl of Array.from(parseXml(sheetXml).getElementsByTagName("row"))) {
    const rowIndex = Number(rowEl.getAttribute("r") ?? matrix.length + 1) - 1;
    const cells: string[] = [];
    for (const c of Array.from(rowEl.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r");
      const col = ref ? columnIndex(ref) : cells.length;
      const type = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(c);
      else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
      else if (/e/i.test(v) && Number.isFinite(Number(v))) value = String(Number(v)); // 9.05E+11 → 905000000000
      else value = v;
      cells[col] = value;
    }
    // صفوف فارغة في الوسط تحافظ على أرقام الأسطر
    while (matrix.length < rowIndex) matrix.push([]);
    matrix[rowIndex] = Array.from(cells, (x) => x ?? "");
  }
  return matrix.map((r) => r ?? []);
}
