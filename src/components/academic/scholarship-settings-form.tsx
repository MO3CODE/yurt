"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { saveGradeScale, saveScholarshipSettings, setStudentGradeScale } from "@/app/admin/academic/settings-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { parseGpa } from "@/lib/grades";
import { DEFAULT_SETTINGS, TIER_META, type GradeScale, type ScholarshipSettings } from "@/lib/scholarship";
import { unwrap } from "@/lib/unwrap";

function NumField({ label, value, onChange, hint, suffix }: { label: string; value: number; onChange: (n: number) => void; hint?: string; suffix?: string }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseGpa(e.target.value);
            if (n !== null && !Number.isNaN(n)) onChange(n);
          }}
          inputMode="decimal"
          dir="ltr"
          className="h-9"
        />
        {suffix && <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>}
      </span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex w-fit gap-1 rounded-xl border p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn("rounded-lg px-3 py-1.5 text-sm", value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ScholarshipSettingsForm({ initial }: { initial: ScholarshipSettings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [version, setVersion] = useState(0); // لإعادة رسم الحقول عند الرجوع للافتراضي
  const [isPending, startTransition] = useTransition();
  const patch = (p: Partial<ScholarshipSettings>) => setS((prev) => ({ ...prev, ...p }));

  function save() {
    startTransition(async () => {
      try {
        await unwrap(saveScholarshipSettings(s));
        toast.success("حُفظت الإعدادات — للترمات المؤكَّدة استخدم «إعادة حساب الترم»");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  return (
    <div key={version} className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>حالة الطالب مع المنحة</CardTitle>
          <CardDescription>تُحسب من المعدل التراكمي بعد تأكيد كشف النهائي</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumField label="متميز من" value={s.statusBands.excellent} onChange={(n) => patch({ statusBands: { ...s.statusBands, excellent: n } })} />
          <NumField label="آمن من" value={s.statusBands.safe} onChange={(n) => patch({ statusBands: { ...s.statusBands, safe: n } })} />
          <NumField
            label="حد المنحة (مراقبة من)"
            value={s.statusBands.watch}
            onChange={(n) => patch({ statusBands: { ...s.statusBands, watch: n } })}
            hint="تحته: إنذار"
          />
          <NumField
            label="ترمات متتالية تحت الحد قبل الإحالة"
            value={s.probationTerms}
            onChange={(n) => patch({ probationTerms: Math.round(n) })}
            hint="حسب لائحة الجهة المانحة"
          />
          <NumField label="هبوط حاد إذا نزل الفصلي أكثر من" value={s.sharpDropThreshold} onChange={(n) => patch({ sharpDropThreshold: n })} />
          <NumField label="أقل عبء دراسي" value={s.minTermCredits} onChange={(n) => patch({ minTermCredits: n })} suffix="ساعة" />
          <NumField label="تسامح تعارض المعدل" value={s.gpaMismatchTolerance} onChange={(n) => patch({ gpaMismatchTolerance: n })} hint="الفرق بين المحسوب والمكتوب" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المواد المتعثرة والدعم</CardTitle>
          <CardDescription>القاعدة على نقاط المادة، فتعمل مع أي سلّم</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumField label="متعثر تحت" value={s.strugglingBelow} onChange={(n) => patch({ strugglingBelow: n })} suffix="نقطة" hint="الصفر = راسب" />
          <NumField label="ضعيف تحت" value={s.weakBelow} onChange={(n) => patch({ weakBelow: n })} suffix="نقطة" />
          <NumField label="متعثر مبكراً في النصفي تحت" value={s.midtermRiskPercent} onChange={(n) => patch({ midtermRiskPercent: n })} suffix="٪" />
          <NumField label="مجموعة تقوية من" value={s.groupTutoringMin} onChange={(n) => patch({ groupTutoringMin: Math.round(n) })} suffix="طلاب" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مسابقة التميز الأكاديمي</CardTitle>
          <CardDescription>تُحسب لكل ترم عند تأكيد كشوف النهائي</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">النمط</span>
              <Segmented
                value={s.awardMode}
                onChange={(v) => patch({ awardMode: v })}
                options={[
                  { value: "bands", label: "فئات حسب المعدل" },
                  { value: "rank", label: "ترتيب (الأول، الثاني…)" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">على المعدل</span>
              <Segmented
                value={s.awardBasis}
                onChange={(v) => patch({ awardBasis: v })}
                options={[
                  { value: "term", label: "الفصلي" },
                  { value: "cumulative", label: "التراكمي" },
                ]}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumField label="أدنى معدل للتأهل" value={s.awardMinGpa} onChange={(n) => patch({ awardMinGpa: n })} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">العملة</span>
              <Input value={s.awardCurrency} onChange={(e) => patch({ awardCurrency: e.target.value })} dir="ltr" maxLength={5} className="h-9" />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Checkbox checked={s.awardRequireNoFail} onCheckedChange={(v) => patch({ awardRequireNoFail: v === true })} /> المادة الراسبة تحرم من الجائزة
            </label>
          </div>

          {s.awardMode === "bands" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {s.awardBands.map((b, i) => (
                <div key={b.tier} className="flex flex-col gap-3 rounded-xl border p-3">
                  <span className="text-sm font-semibold">
                    {TIER_META[b.tier].medal} {TIER_META[b.tier].label}
                  </span>
                  <NumField label="من معدل" value={b.min} onChange={(n) => patch({ awardBands: s.awardBands.map((x, j) => (j === i ? { ...x, min: n } : x)) })} />
                  <NumField label="الجائزة" value={b.amount} onChange={(n) => patch({ awardBands: s.awardBands.map((x, j) => (j === i ? { ...x, amount: n } : x)) })} suffix={s.awardCurrency} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {s.awardRankSlots.map((b, i) => (
                <div key={b.tier} className="flex flex-col gap-3 rounded-xl border p-3">
                  <span className="text-sm font-semibold">
                    {TIER_META[b.tier].medal} المركز {i + 1}
                  </span>
                  <NumField
                    label="عدد الفائزين"
                    value={b.count}
                    onChange={(n) => patch({ awardRankSlots: s.awardRankSlots.map((x, j) => (j === i ? { ...x, count: Math.round(n) } : x)) })}
                  />
                  <NumField
                    label="الجائزة"
                    value={b.amount}
                    onChange={(n) => patch({ awardRankSlots: s.awardRankSlots.map((x, j) => (j === i ? { ...x, amount: n } : x)) })}
                    suffix={s.awardCurrency}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-3">المتعادلون في المعدل (والتراكمي) يأخذون المركز نفسه.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={isPending}>
          {isPending ? <Spinner /> : <Save />} حفظ الإعدادات
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setS(DEFAULT_SETTINGS);
            setVersion((v) => v + 1);
          }}
          disabled={isPending}
        >
          <RotateCcw /> القيم الافتراضية
        </Button>
      </div>
    </div>
  );
}

/** سلّم درجات: سطر لكل رمز «الحرف النقاط»، و«-» للرمز الذي لا يُحتسب */
export function GradeScaleEditor({ scale }: { scale: GradeScale }) {
  const router = useRouter();
  const [name, setName] = useState(scale.name);
  const [text, setText] = useState(scale.items.map((i) => `${i.letter} ${i.points === null ? "-" : i.points}`).join("\n"));
  const [isPending, startTransition] = useTransition();

  function save() {
    const items = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [letter, raw = ""] = l.split(/[\s=:]+/);
        return { letter, points: raw === "-" || raw === "" ? null : parseGpa(raw) };
      });
    if (items.some((i) => i.points !== null && (Number.isNaN(i.points) || i.points < 0 || i.points > 4))) return toast.error("النقاط بين ٠ و٤، أو «-» للرمز الذي لا يُحتسب");
    startTransition(async () => {
      try {
        await unwrap(saveGradeScale({ key: scale.key, name, items: items as { letter: string; points: number | null }[] }));
        toast.success(`حُفظ سلّم ${name}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 font-medium" maxLength={60} aria-label="اسم السلّم" />
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} dir="ltr" className="font-mono text-sm" aria-label="رموز السلّم" />
      <Button size="sm" variant="outline" className="w-fit" onClick={save} disabled={isPending}>
        {isPending ? <Spinner /> : <Save />} حفظ السلّم
      </Button>
    </div>
  );
}

export function StudentScaleSelect({ studentId, value, scales }: { studentId: string; value: string; scales: { key: string; name: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const items = scales.map((s) => ({ value: s.key, label: s.name }));
  return (
    <Select
      value={value}
      items={items}
      disabled={isPending}
      onValueChange={(v) =>
        v &&
        startTransition(async () => {
          try {
            await unwrap(setStudentGradeScale(studentId, v as string));
            toast.success("تغيّر سلّم الدرجات");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
          }
        })
      }
    >
      <SelectTrigger className="h-8 w-full" aria-label="سلّم درجات الطالب">
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
