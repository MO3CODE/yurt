"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Download, FileSpreadsheet, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { importTermResults } from "@/app/admin/academic/grades-actions";
import { matchStudentByName } from "@/lib/academic";
import { formatGpa } from "@/lib/grades";
import { RESULT_HEADERS, parseResultRows, textToMatrix } from "@/lib/term-import";
import { buildXlsx, readXlsx } from "@/lib/xlsx-lite";
import { unwrap } from "@/lib/unwrap";
import { cn } from "@/lib/utils";

const SKIP = "__skip";

export function downloadXlsx(name: string, rows: string[][], sheetName: string) {
  const bytes = buildXlsx(rows, { sheetName });
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** اختيار الطالب يدوياً لما لم يُطابَق اسمه تلقائياً */
export function StudentPicker({ students, value, onChange }: { students: { id: string; name: string }[]; value: string | null; onChange: (id: string | null) => void }) {
  const items = [{ value: SKIP, label: "تجاهل هذا الصف" }, ...students.map((s) => ({ value: s.id, label: s.name }))];
  return (
    <Select value={value ?? SKIP} onValueChange={(v) => onChange(!v || v === SKIP ? null : (v as string))} items={items}>
      <SelectTrigger className="h-8 w-full min-w-40" aria-label="الطالب في المنصة">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** استيراد نتائج سنة دراسية (فصلان) من تقرير Excel إلى ترمين أرشيفيين */
export function TermImportDialog({ students }: { students: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const startYear = Number(year);
  const label = Number.isInteger(startYear) ? `${startYear}–${startYear + 1}` : "";
  const [fallName, setFallName] = useState<string | null>(null);
  const [springName, setSpringName] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<string[][]>([]);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const fall = fallName ?? `الفصل الأول ${label}`;
  const spring = springName ?? `الفصل الثاني ${label}`;

  const rows = useMemo(() => {
    const source = matrix.length ? matrix : textToMatrix(text);
    return parseResultRows(source).map((r) => {
      const m = matchStudentByName(r.name, students);
      const auto = m.kind === "match" ? m.id : null;
      const studentId = r.line in overrides ? overrides[r.line] : auto;
      return { ...r, matchKind: m.kind, studentId };
    });
  }, [matrix, text, students, overrides]);

  const ready = rows.filter((r) => !r.problem && r.studentId);
  const dupes = new Set(ready.map((r) => r.studentId).filter((id, i, a) => a.indexOf(id) !== i));
  const nameOf = new Map(students.map((s) => [s.id, s.name]));

  async function pickFile(file: File | undefined) {
    if (!file) return;
    try {
      setMatrix(await readXlsx(file));
      setFileName(file.name);
      setOverrides({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّرت قراءة الملف");
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function submit() {
    if (!Number.isInteger(startYear) || startYear < 2015) return toast.error("اكتب سنة بداية العام الدراسي، مثل 2025");
    if (dupes.size) return toast.error("طالب واحد مطابَق لأكثر من صف — صحّح المطابقة");
    startTransition(async () => {
      try {
        const res = await unwrap(
          importTermResults({
            startYear,
            fallName: fall,
            springName: spring,
            rows: ready.map((r) => ({ studentId: r.studentId as string, t1: r.t1, t2: r.t2, overall: r.overall })),
          })
        );
        toast.success(`استُوردت نتائج ${res.students} طالب (${res.standings} حالة ترم)، وحُسبت الجوائز`);
        setOpen(false);
        setMatrix([]);
        setText("");
        setFileName(null);
        router.push(`/admin/academic/grades?term=${res.springId}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الاستيراد");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <FileSpreadsheet /> استيراد نتائج سنة سابقة
          </Button>
        }
      />
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>استيراد نتائج سنة دراسية من تقرير</DialogTitle>
          <DialogDescription>
            لكل طالب: عدد المواد والناجح والراسب ومعدل كل فصل، والمعدل العام. يُنشأ الفصلان كترمين أرشيفيين (لا يُطلب فيهما رفع كشف ولا يصل
            إشعار)، وتُحسب حالة كل طالب وجوائز التميز. الساعات لا تذكرها التقارير، فلا يُطبَّق شرط العبء الدراسي.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ti-year">بداية العام الدراسي</Label>
              <Input id="ti-year" value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" dir="ltr" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ti-fall">اسم الفصل الأول</Label>
              <Input id="ti-fall" value={fall} onChange={(e) => setFallName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ti-spring">اسم الفصل الثاني</Label>
              <Input id="ti-spring" value={spring} onChange={(e) => setSpringName(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <FileUp /> {fileName ?? "اختر ملف Excel"}
            </Button>
            <input ref={fileInput} type="file" accept=".xlsx" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            <Button variant="ghost" size="sm" onClick={() => downloadXlsx("قالب نتائج السنة.xlsx", [RESULT_HEADERS], "النتائج")}>
              <Download /> القالب
            </Button>
            {fileName && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMatrix([]);
                  setFileName(null);
                }}
              >
                أو الصق جدولاً بدلاً منه
              </Button>
            )}
          </div>
          {!fileName && (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              dir="auto"
              placeholder={`أو الصق الجدول من Excel بأعمدته: ${RESULT_HEADERS.join(" | ")}`}
            />
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start font-medium">في التقرير</th>
                    <th className="p-2 text-start font-medium">في المنصة</th>
                    <th className="p-2 font-medium">الفصل الأول</th>
                    <th className="p-2 font-medium">الفصل الثاني</th>
                    <th className="p-2 font-medium">العام</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const bad = !!r.problem || !r.studentId || (r.studentId && dupes.has(r.studentId));
                    return (
                      <tr key={r.line} className={cn(bad && "bg-destructive/[0.04]")}>
                        <td className="p-2">
                          <span className="flex items-center gap-1.5 font-medium">
                            {bad ? <AlertTriangle className="size-3.5 shrink-0 text-destructive" /> : <Check className="size-3.5 shrink-0 text-success" />}
                            {r.name}
                          </span>
                          {r.university && <span className="block text-[11px] text-muted-foreground">{r.university}</span>}
                          {(r.problem || r.warning) && <span className="block text-[11px] text-destructive">{r.problem ?? r.warning}</span>}
                        </td>
                        <td className="p-2">
                          {r.problem ? (
                            <span className="text-xs text-muted-foreground">لن يُستورد</span>
                          ) : r.matchKind === "match" && !(r.line in overrides) ? (
                            <button type="button" className="text-start text-xs hover:underline" onClick={() => setOverrides((o) => ({ ...o, [r.line]: r.studentId }))}>
                              {nameOf.get(r.studentId as string)}
                            </button>
                          ) : (
                            <StudentPicker students={students} value={r.studentId} onChange={(id) => setOverrides((o) => ({ ...o, [r.line]: id }))} />
                          )}
                          {r.matchKind === "ambiguous" && !(r.line in overrides) && <span className="block text-[11px] text-muted-foreground">الاسم يطابق أكثر من طالب</span>}
                        </td>
                        {[r.t1, r.t2].map((t, i) => (
                          <td key={i} className="p-2 text-center text-xs tabular-nums">
                            {t ? (
                              <>
                                <span className="font-semibold">{formatGpa(t.gpa)}</span>
                                {t.courses !== null && (
                                  <span className="block text-muted-foreground">
                                    {t.courses} مادة{t.failed ? ` · ${t.failed} راسب` : ""}
                                  </span>
                                )}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        ))}
                        <td className="p-2 text-center text-xs font-semibold tabular-nums">{formatGpa(r.overall)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={isPending || ready.length === 0}>
            {isPending ? <Spinner /> : <Check />} استيراد {ready.length ? `${ready.length} طالب` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
