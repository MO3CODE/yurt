"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCredits, formatGpa, type ReportKind } from "@/lib/grades";
import { emptyCourse, previewCourses, type CourseDraft } from "@/lib/course-drafts";
import { RISK_META, type GradeScale, type ScholarshipSettings } from "@/lib/scholarship";

// جدول مواد الكشف: يكتبه الطالب في «درجاتي»، وتصحّحه الإدارة عند المراجعة

export function CourseRowsEditor({
  rows,
  onChange,
  kind,
  scale,
  settings,
  suggestions = [],
  allowHelp = false,
  disabled = false,
}: {
  rows: CourseDraft[];
  onChange: (rows: CourseDraft[]) => void;
  kind: ReportKind;
  scale: GradeScale;
  settings: ScholarshipSettings;
  suggestions?: string[];
  allowHelp?: boolean;
  disabled?: boolean;
}) {
  const listId = useId();
  const isFinal = kind === "final";
  const { classified, gpa, credits } = previewCourses(rows, kind, scale, settings);
  const set = (i: number, patch: Partial<CourseDraft>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const letters = scale.items.map((it) => ({ value: it.letter, label: it.points === null ? `${it.letter} (لا يُحتسب)` : `${it.letter} · ${it.points}` }));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">المواد{isFinal ? ` — سلّم ${scale.name}` : " — درجة النصفي من ١٠٠"}</span>
        {isFinal && gpa !== null && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            المحسوب: <span className="tabular-nums">{formatGpa(gpa)}</span> · {formatCredits(credits)} ساعة
          </span>
        )}
      </div>

      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <ol className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const risk = classified[i]?.risk;
          return (
            <li key={i} className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  value={r.name}
                  onChange={(e) => set(i, { name: e.target.value })}
                  list={listId}
                  placeholder={`المادة ${i + 1}، مثل Matematik I`}
                  aria-label={`اسم المادة ${i + 1}`}
                  className="h-9 flex-1"
                  maxLength={120}
                  disabled={disabled}
                />
                {risk && risk !== "ok" && (
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", RISK_META[risk].className)}>{RISK_META[risk].label}</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [emptyCourse()])}
                  aria-label={`حذف المادة ${i + 1}`}
                  disabled={disabled}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
                <Input
                  value={r.code}
                  onChange={(e) => set(i, { code: e.target.value })}
                  placeholder="الرمز"
                  aria-label="رمز المادة"
                  className="h-9"
                  dir="ltr"
                  maxLength={20}
                  disabled={disabled}
                />
                <Input
                  value={r.credits}
                  onChange={(e) => set(i, { credits: e.target.value })}
                  inputMode="decimal"
                  placeholder="الساعات"
                  aria-label="الساعات المعتمدة"
                  className="h-9"
                  dir="ltr"
                  disabled={disabled}
                />
                {isFinal ? (
                  <Select value={r.letter || null} onValueChange={(v) => set(i, { letter: (v as string) ?? "" })} items={letters} disabled={disabled}>
                    <SelectTrigger className="h-9 w-full" aria-label="الدرجة">
                      <SelectValue placeholder="الدرجة" />
                    </SelectTrigger>
                    <SelectContent>
                      {letters.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={r.percent}
                    onChange={(e) => set(i, { percent: e.target.value })}
                    inputMode="decimal"
                    placeholder="الدرجة ٪"
                    aria-label="درجة النصفي من ١٠٠"
                    className="h-9"
                    dir="ltr"
                    disabled={disabled}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <label className="flex items-center gap-1.5">
                  <Checkbox checked={r.isRepeat} onCheckedChange={(v) => set(i, { isRepeat: v === true })} disabled={disabled} /> مادة مُعادة
                </label>
                {allowHelp && (
                  <label className="flex items-center gap-1.5">
                    <Checkbox checked={r.help} onCheckedChange={(v) => set(i, { help: v === true })} disabled={disabled} /> أحتاج دعماً فيها
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...rows, emptyCourse()])} disabled={disabled || rows.length >= 15}>
        <Plus /> مادة أخرى
      </Button>
    </div>
  );
}
