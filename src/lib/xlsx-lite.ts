// قراءة أول ورقة من ملف .xlsx في المتصفح (نصوص وأرقام فقط) دون مكتبة جداول ثقيلة.
// ملف xlsx هو أرشيف zip فيه XML: sharedStrings للنصوص، وworksheets للخلايا.
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

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

// ---------------------------------------------------------------------
// كتابة ملف .xlsx بسيط (ورقة واحدة، نصوص فقط، من اليمين لليسار)
// النصوص نصّية دائماً فلا يحوّل Excel الهاتف إلى رقم علمي ولا يحذف الصفر البادئ.
// ---------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// يمنع محارف التحكم غير المسموحة في XML
const clean = (s: string) => esc(s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""));

function colName(i: number): string {
  let n = i + 1;
  let out = "";
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** السطر الأول عناوين (بخط عريض)؛ كل قيمة في خلية مستقلة */
export function buildXlsx(rows: string[][], opts: { sheetName?: string; widths?: number[] } = {}): Uint8Array {
  const sheetName = clean((opts.sheetName ?? "Sheet1").slice(0, 31));
  const cols = Math.max(...rows.map((r) => r.length), 1);
  const widths = opts.widths ?? Array.from({ length: cols }, () => 22);

  const sheetRows = rows
    .map((cells, r) => {
      const cs = cells
        .map((v, c) => (v === "" ? "" : `<c r="${colName(c)}${r + 1}" t="inlineStr"${r === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${clean(v)}</t></is></c>`))
        .join("");
      return `<row r="${r + 1}">${cs}</row>`;
    })
    .join("");

  const xml = (s: string) => strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${s}`);
  return zipSync({
    "[Content_Types].xml": xml(
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
    ),
    "_rels/.rels": xml(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    ),
    "xl/workbook.xml": xml(
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`
    ),
    "xl/_rels/workbook.xml.rels": xml(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    ),
    "xl/styles.xml": xml(
      `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F1EE"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
    ),
    "xl/worksheets/sheet1.xml": xml(
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join("")}</cols><sheetData>${sheetRows}</sheetData></worksheet>`
    ),
  });
}
