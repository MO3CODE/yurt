"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { hafsFont } from "@/components/quran/hafs-font";
import { cn } from "@/lib/utils";
import { SURAHS, arNum, clampPage, type QuranAya } from "@/lib/quran";
import { ayaPlainText } from "@/lib/quran/recitation";

// تفسير كل صفحة يُحمَّل مرة واحدة في الجلسة
const tafsirCache = new Map<number, Promise<Record<string, string>>>();
function loadTafsir(page: number) {
  let p = tafsirCache.get(page);
  if (!p) {
    p = fetch(`/quran/tafsir/${String(clampPage(page)).padStart(3, "0")}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Record<string, string>>;
      })
      .catch((e) => {
        tafsirCache.delete(page);
        throw e;
      });
    tafsirCache.set(page, p);
  }
  return p;
}

export function AyahSheet({
  aya,
  page,
  onOpenChange,
  onListen,
  children,
}: {
  aya: QuranAya | null;
  page: number;
  onOpenChange: (open: boolean) => void;
  onListen: (key: string) => void;
  /** أزرار إضافية (مثل حفظ الآية في العلامات) */
  children?: React.ReactNode;
}) {
  const key = aya ? `${aya.s}:${aya.a}` : null;
  const [tafsir, setTafsir] = useState<{ key: string; text: string | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    loadTafsir(page)
      .then((t) => alive && setTafsir({ key, text: t[key] ?? null }))
      .catch(() => alive && setTafsir({ key, text: null }));
    return () => {
      alive = false;
    };
  }, [key, page]);

  const surahName = aya ? SURAHS[aya.s - 1].name : "";
  const loaded = tafsir?.key === key;

  async function copy() {
    if (!aya) return;
    try {
      await navigator.clipboard.writeText(`﴿${ayaPlainText(aya.t)}﴾ [${surahName}: ${arNum(aya.a)}]`);
      toast.success("نُسخت الآية");
    } catch {
      toast.error("تعذّر النسخ على هذا الجهاز");
    }
  }

  return (
    <Sheet open={aya !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] gap-0 rounded-t-2xl p-0">
        <SheetHeader className="border-b">
          <SheetTitle>
            {surahName} — الآية {aya ? arNum(aya.a) : ""}
          </SheetTitle>
        </SheetHeader>
        {aya && (
          <div className="flex flex-col gap-4 overflow-y-auto p-4 pb-8">
            <p className={cn(hafsFont.className, "text-center text-[1.4rem] leading-[2.2] text-foreground")}>{aya.t}</p>

            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => onListen(key!)}>
                <Headphones /> استمع من هذه الآية
              </Button>
              <Button size="sm" variant="outline" onClick={copy}>
                <Copy /> نسخ الآية
              </Button>
              {children}
            </div>

            <section className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-3">
              <span className="text-xs font-medium text-muted-foreground">التفسير الميسّر</span>
              {loaded ? (
                <p className="text-[0.95rem] leading-loose">{tafsir.text ?? "تعذّر تحميل التفسير، حاول مرة أخرى."}</p>
              ) : (
                <div className="flex flex-col gap-2 py-1">
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                </div>
              )}
              <span className="pt-1 text-[11px] text-muted-foreground">مجمّع الملك فهد لطباعة المصحف الشريف، عبر Tanzil.net</span>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
