"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ListTree,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCw,
  Search,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { AyahSheet } from "@/components/quran/ayah-sheet";
import { useRecitation } from "@/components/quran/use-recitation";
import { RECITERS, tracksFor, type ReciterId } from "@/lib/quran/recitation";
import { cn } from "@/lib/utils";
import { hafsFont } from "@/components/quran/hafs-font";
import { recordQuranPage } from "@/app/app/quran/actions";
import { toggleBookmark } from "@/app/app/quran/bookmark-actions";
import {
  BASMALA,
  JUZ_START_PAGES,
  QURAN_PAGES,
  SURAHS,
  arNum,
  clampPage,
  pageInfo,
  pageUrl,
  type QuranAya,
  type QuranPage,
} from "@/lib/quran";

/** الصفحة تُحسب مقروءة بعد هذا العدد من الثواني وهي ظاهرة على الشاشة */
const READ_SECONDS = 30;
const FONT_SIZES = [18, 21, 24, 28];

// الصفحات تُحمَّل مرة واحدة في الجلسة، والمجاورتان مسبقاً
const pageCache = new Map<number, Promise<QuranPage>>();
function loadPage(page: number): Promise<QuranPage> {
  let p = pageCache.get(page);
  if (!p) {
    p = fetch(pageUrl(page))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<QuranPage>;
      })
      .catch((e) => {
        pageCache.delete(page);
        throw e;
      });
    pageCache.set(page, p);
  }
  return p;
}

// حجم الخط محفوظ في الجهاز
const FONT_KEY = "mushaf-font-size";
const fontListeners = new Set<() => void>();
function subscribeFont(cb: () => void) {
  fontListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    fontListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readFontIndex(): number {
  try {
    const v = Number(localStorage.getItem(FONT_KEY) ?? 1);
    return Number.isInteger(v) && v >= 0 && v < FONT_SIZES.length ? v : 1;
  } catch {
    return 1;
  }
}
function writeFontIndex(i: number) {
  try {
    localStorage.setItem(FONT_KEY, String(i));
  } catch {}
  fontListeners.forEach((l) => l());
}

type Segment = { kind: "surah"; surah: number } | { kind: "text"; ayas: QuranAya[] };

function toSegments(ayas: QuranAya[]): Segment[] {
  const out: Segment[] = [];
  for (const aya of ayas) {
    if (aya.a === 1) out.push({ kind: "surah", surah: aya.s });
    const last = out.at(-1);
    if (last?.kind === "text") last.ayas.push(aya);
    else out.push({ kind: "text", ayas: [aya] });
  }
  return out;
}

export function MushafReader({
  initialPage,
  initialBookmark,
  initialKhatmas,
  readToday,
  mushafPagesToday,
  dailyGoal,
  initialAya = null,
  bookmarkedKeys = [],
}: {
  initialPage: number;
  initialBookmark: number;
  initialKhatmas: number;
  readToday: number[];
  /** صفحات المصحف الورقي المسجّلة اليوم (تُجمع مع صفحات المنصة في الهدف) */
  mushafPagesToday: number;
  dailyGoal: number | null;
  /** آية تُظلَّل عند الفتح (من البحث أو العلامات)، بصيغة «سورة:آية» */
  initialAya?: string | null;
  bookmarkedKeys?: string[];
}) {
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState<QuranPage | null>(null);
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const [read, setRead] = useState(() => new Set(readToday));
  const [bookmark, setBookmark] = useState(initialBookmark);
  const [khatmas, setKhatmas] = useState(initialKhatmas);
  const [elapsed, setElapsed] = useState({ page: initialPage, seconds: 0 });
  const [indexOpen, setIndexOpen] = useState(false);
  const [selectedAya, setSelectedAya] = useState<QuranAya | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(initialAya);
  const [bookmarks, setBookmarks] = useState(() => new Set(bookmarkedKeys));
  const [savingBookmark, setSavingBookmark] = useState(false);
  const fontIndex = useSyncExternalStore(subscribeFont, readFontIndex, () => 1);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // بعد انتهاء تلاوة الصفحة ننتقل للتالية ونكمل التلاوة فور تحميلها
  const continueRecitation = useRef(false);

  const recitation = useRecitation({
    onPageEnd: () => {
      if (page < QURAN_PAGES) {
        continueRecitation.current = true;
        setPage(page + 1);
      } else recitation.stop();
    },
    onError: () => toast.error("تعذّر تشغيل التلاوة، تحقّق من اتصالك بالإنترنت"),
  });
  const recitationRef = useRef(recitation);
  useEffect(() => {
    recitationRef.current = recitation;
  });

  const loaded = data?.page === page;
  const isRead = read.has(page);
  const seconds = elapsed.page === page ? elapsed.seconds : 0;
  const { surah, juz } = pageInfo(page);

  const go = useCallback((p: number) => setPage(clampPage(p)), []);

  // تحميل الصفحة والمجاورتين، وتحديث الرابط بلا إعادة تحميل
  useEffect(() => {
    let alive = true;
    loadPage(page)
      .then((d) => {
        if (!alive) return;
        setData(d);
        if (continueRecitation.current) {
          continueRecitation.current = false;
          const r = recitationRef.current;
          r.play(tracksFor(d.ayas, r.reciter));
        }
      })
      .catch(() => alive && setFailedPage(page));
    if (page > 1) loadPage(page - 1).catch(() => {});
    if (page < QURAN_PAGES) loadPage(page + 1).catch(() => {});
    window.history.replaceState(null, "", `?page=${page}`);
    window.scrollTo({ top: 0 });
    return () => {
      alive = false;
    };
  }, [page, retry]);

  const submit = useCallback(async (p: number) => {
    const r = await recordQuranPage(p);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    if (r.data.counted) setRead((prev) => new Set(prev).add(p));
    setBookmark(r.data.current_page);
    setKhatmas(r.data.khatmas);
    if (r.data.khatma_completed) toast.success("بارك الله فيك، أتممت ختمة كاملة");
    else if (r.data.counted && dailyGoal && r.data.today_pages + mushafPagesToday === dailyGoal)
      toast.success("أتممت وردك اليوم، بارك الله فيك");
    if (r.data.points > 0) toast(`+${arNum(r.data.points)} نقطة`, { icon: "⭐" });
  }, [dailyGoal, mushafPagesToday]);

  // عدّاد القراءة: يعدّ فقط والصفحة ظاهرة، ويتوقف إذا خرج الطالب من التطبيق
  useEffect(() => {
    if (!loaded || isRead) return;
    let count = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      count += 1;
      setElapsed({ page, seconds: count });
      if (count >= READ_SECONDS) {
        window.clearInterval(id);
        void submit(page);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [page, loaded, isRead, submit]);

  // الآية التي تُتلى تبقى ظاهرة على الشاشة
  useEffect(() => {
    if (!recitation.state.key) return;
    const el = document.querySelector(`[data-aya="${recitation.state.key}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 140) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [recitation.state.key]);

  // الآية القادمة من البحث تُعرض في وسط الشاشة
  useEffect(() => {
    if (!focusKey || !loaded) return;
    document.querySelector(`[data-aya="${focusKey}"]`)?.scrollIntoView({ block: "center" });
  }, [focusKey, loaded]);

  async function toggleSelectedBookmark() {
    if (!selectedAya) return;
    const key = `${selectedAya.s}:${selectedAya.a}`;
    setSavingBookmark(true);
    const r = await toggleBookmark({ surah: selectedAya.s, aya: selectedAya.a, page });
    setSavingBookmark(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (r.data.saved) next.add(key);
      else next.delete(key);
      return next;
    });
    toast.success(r.data.saved ? "حُفظت الآية في علاماتك" : "أُزيلت الآية من علاماتك");
  }

  function togglePlay() {
    if (recitation.toggle() || !loaded) return;
    recitation.play(tracksFor(data.ayas, recitation.reciter));
  }

  // الأسهم: اليسار للأمام كاتجاه تقليب المصحف
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") go(page + 1);
      if (e.key === "ArrowRight") go(page - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, go]);

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
    // السحب نحو اليمين يقلب للصفحة التالية كما في المصحف
    recitation.stop();
    go(dx > 0 ? page + 1 : page - 1);
  }

  const segments = data ? toSegments(data.ayas) : [];
  const progress = Math.min(1, seconds / READ_SECONDS);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      {/* الشريط العلوي */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/app/quran" />}>
          <ArrowRight /> الورد
        </Button>
        <div className="flex min-w-0 flex-col items-center text-center leading-tight">
          <span className="truncate font-medium">{surah.name}</span>
          <span className="text-xs text-muted-foreground">الجزء {arNum(juz)}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="تصغير الخط"
            disabled={fontIndex === 0}
            onClick={() => writeFontIndex(fontIndex - 1)}
          >
            <Minus />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="تكبير الخط"
            disabled={fontIndex === FONT_SIZES.length - 1}
            onClick={() => writeFontIndex(fontIndex + 1)}
          >
            <Plus />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="البحث والعلامات" nativeButton={false} render={<Link href="/app/quran/search" />}>
            <Search />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="الفهرس" onClick={() => setIndexOpen(true)}>
            <ListTree />
          </Button>
        </div>
      </div>

      {/* ورقة المصحف */}
      <div
        className="rounded-2xl bg-mushaf-paper p-2.5 shadow-soft sm:p-4"
        onTouchStart={(e) => (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={onTouchEnd}
      >
        <div className="min-h-[60vh] rounded-lg border border-mushaf-frame px-3 py-4 outline outline-mushaf-frame outline-offset-[3px] sm:px-6 sm:py-6">
          {data && failedPage !== page ? (
            // الصفحة السابقة تبقى ظاهرة (باهتة) حتى تصل الجديدة، بدل وميض فارغ عند كل تقليب
            <div
              className={cn(
                hafsFont.className,
                "text-justify text-mushaf-ink transition-opacity [text-align-last:center]",
                !loaded && "opacity-50"
              )}
              style={{ fontSize: FONT_SIZES[fontIndex], lineHeight: 2.15 }}
            >
              {segments.map((seg, i) =>
                seg.kind === "surah" ? (
                  <div key={`s${seg.surah}`} className="my-2 flex flex-col items-center gap-1 first:mt-0">
                    <div className="w-full rounded-md border border-mushaf-frame bg-mushaf-title py-0.5 text-center text-mushaf-title-ink">
                      سُورَةُ {SURAHS[seg.surah - 1].title}
                    </div>
                    {seg.surah !== 1 && seg.surah !== 9 && <div className="text-center">{BASMALA}</div>}
                  </div>
                ) : (
                  <p key={`t${i}`}>
                    {seg.ayas.map((aya) => {
                      const k = `${aya.s}:${aya.a}`;
                      const active =
                        recitation.state.key === k || focusKey === k || (selectedAya && `${selectedAya.s}:${selectedAya.a}` === k);
                      return (
                        <span key={k}>
                          <span
                            data-aya={k}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setFocusKey(null);
                              setSelectedAya(aya);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && setSelectedAya(aya)}
                            className={cn(
                              "cursor-pointer rounded-md transition-colors duration-300 [box-decoration-break:clone]",
                              active ? "bg-mushaf-frame/25" : "hover:bg-mushaf-frame/10"
                            )}
                          >
                            {aya.t}
                            {bookmarks.has(k) && <BookmarkCheck className="ms-0.5 inline size-[0.6em] align-super text-gold" aria-label="في علاماتك" />}
                          </span>{" "}
                        </span>
                      );
                    })}
                  </p>
                )
              )}
            </div>
          ) : failedPage === page ? (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              تعذّر تحميل الصفحة
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFailedPage(null);
                  setRetry((n) => n + 1);
                }}
              >
                <RotateCw /> إعادة المحاولة
              </Button>
            </div>
          ) : (
            <div className="flex h-[50vh] items-center justify-center">
              <div className="h-1 w-24 animate-pulse rounded-full bg-mushaf-frame" />
            </div>
          )}
        </div>

        {/* رقم الصفحة مع حلقة عدّاد القراءة */}
        <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-mushaf-muted">
          <span className="relative inline-flex size-7 items-center justify-center" aria-hidden>
            {isRead ? (
              <Check className="size-4 text-success" />
            ) : (
              <svg viewBox="0 0 28 28" className="size-7 -rotate-90">
                <circle cx="14" cy="14" r="11" fill="none" strokeWidth="2" className="stroke-mushaf-frame/30" />
                <circle
                  cx="14"
                  cy="14"
                  r="11"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="stroke-mushaf-frame transition-[stroke-dashoffset] duration-1000 ease-linear"
                  strokeDasharray={2 * Math.PI * 11}
                  strokeDashoffset={2 * Math.PI * 11 * (1 - progress)}
                />
              </svg>
            )}
          </span>
          <span className="tabular-nums">{arNum(page)}</span>
          <span className="sr-only">{isRead ? "مقروءة اليوم" : "لم تُحسب بعد"}</span>
          {page === bookmark && (
            <span className="ms-1 inline-flex items-center gap-0.5 text-xs">
              <Bookmark className="size-3.5" /> علامتك
            </span>
          )}
        </div>
      </div>

      {/* التنقل */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => (recitation.stop(), go(page - 1))} disabled={page === 1}>
          <ChevronRight /> السابقة
        </Button>
        <span className="text-xs text-muted-foreground">
          {dailyGoal
            ? `${arNum(read.size + mushafPagesToday)} / ${arNum(dailyGoal)} اليوم`
            : `${arNum(read.size + mushafPagesToday)} اليوم`}{" "}
          · {arNum(khatmas)} ختمة
        </span>
        <Button variant="outline" onClick={() => (recitation.stop(), go(page + 1))} disabled={page === QURAN_PAGES}>
          التالية <ChevronLeft />
        </Button>
      </div>

      {/* التلاوة */}
      <div className="flex items-center gap-2 rounded-xl border bg-card p-2 shadow-soft">
        <Button
          size="icon"
          onClick={togglePlay}
          disabled={!loaded}
          aria-label={recitation.state.status === "playing" ? "إيقاف مؤقت" : "تشغيل التلاوة"}
        >
          {recitation.state.status === "loading" ? <Spinner /> : recitation.state.status === "playing" ? <Pause /> : <Play />}
        </Button>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {recitation.state.key
            ? `${SURAHS[Number(recitation.state.key.split(":")[0]) - 1].name} — الآية ${arNum(Number(recitation.state.key.split(":")[1]))}`
            : "استمع للصفحة، أو اضغط آية لتفسيرها"}
        </span>
        <Select
          value={recitation.reciter}
          onValueChange={(v) => v && recitation.changeReciter(v as ReciterId, (id) => (data ? tracksFor(data.ayas, id) : []))}
          items={RECITERS.map((r) => ({ value: r.id, label: r.name }))}
        >
          <SelectTrigger size="sm" className="w-36 shrink-0 sm:w-44" aria-label="القارئ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECITERS.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {recitation.state.status !== "idle" && (
          <Button variant="ghost" size="icon-sm" onClick={recitation.stop} aria-label="إيقاف التلاوة">
            <Square />
          </Button>
        )}
      </div>

      {page !== bookmark && (
        <Button variant="ghost" size="sm" className="self-center" onClick={() => go(bookmark)}>
          <Bookmark /> إلى علامتك (ص {arNum(bookmark)})
        </Button>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        نص المصحف وخطّه: مجمّع الملك فهد لطباعة المصحف الشريف — رواية حفص عن عاصم
      </p>

      <AyahSheet
        aya={selectedAya}
        page={page}
        onOpenChange={(open) => !open && setSelectedAya(null)}
        onListen={(key) => {
          if (data) recitation.play(tracksFor(data.ayas, recitation.reciter), key);
          setSelectedAya(null);
        }}
      >
        {selectedAya && (
          <Button size="sm" variant="outline" onClick={toggleSelectedBookmark} disabled={savingBookmark}>
            {bookmarks.has(`${selectedAya.s}:${selectedAya.a}`) ? (
              <>
                <BookmarkCheck className="text-gold" /> في علاماتي
              </>
            ) : (
              <>
                <BookmarkPlus /> احفظ في علاماتي
              </>
            )}
          </Button>
        )}
      </AyahSheet>

      <MushafIndex
        open={indexOpen}
        onOpenChange={setIndexOpen}
        currentSurah={surah.n}
        currentJuz={juz}
        onSelect={(p) => {
          recitation.stop();
          go(p);
          setIndexOpen(false);
        }}
      />
    </div>
  );
}

function MushafIndex({
  open,
  onOpenChange,
  currentSurah,
  currentJuz,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSurah: number;
  currentJuz: number;
  onSelect: (page: number) => void;
}) {
  const [pageInput, setPageInput] = useState("");
  const target = Number(pageInput);
  const validTarget = Number.isInteger(target) && target >= 1 && target <= QURAN_PAGES;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[85vw] gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle>فهرس المصحف</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="surahs" className="min-h-0 flex-1 p-3">
          <TabsList className="w-full">
            <TabsTrigger value="surahs">السور</TabsTrigger>
            <TabsTrigger value="juz">الأجزاء</TabsTrigger>
            <TabsTrigger value="page">صفحة</TabsTrigger>
          </TabsList>
          <TabsContent value="surahs" className="min-h-0 overflow-y-auto">
            <ul className="flex flex-col">
              {SURAHS.map((s) => (
                <li key={s.n}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.page)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-start hover:bg-muted",
                      s.n === currentSurah && "bg-accent text-accent-foreground"
                    )}
                  >
                    <span className="w-7 text-center text-xs text-muted-foreground tabular-nums">{arNum(s.n)}</span>
                    <span className="flex-1">{s.name}</span>
                    <span className="text-xs text-muted-foreground">ص {arNum(s.page)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="juz" className="min-h-0 overflow-y-auto">
            <div className="grid grid-cols-3 gap-2">
              {JUZ_START_PAGES.map((p, i) => (
                <Button
                  key={i}
                  variant={i + 1 === currentJuz ? "secondary" : "outline"}
                  className="h-auto flex-col gap-0 py-2"
                  onClick={() => onSelect(p)}
                >
                  <span>الجزء {arNum(i + 1)}</span>
                  <span className="text-xs font-normal text-muted-foreground">ص {arNum(p)}</span>
                </Button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="page">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (validTarget) onSelect(target);
              }}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={QURAN_PAGES}
                placeholder="١ – ٦٠٤"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                aria-label="رقم الصفحة"
              />
              <Button type="submit" disabled={!validTarget}>
                انتقال
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
