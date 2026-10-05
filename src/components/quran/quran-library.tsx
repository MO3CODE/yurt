"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BookmarkX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { deleteBookmark, updateBookmarkNote } from "@/app/app/quran/bookmark-actions";
import { SURAHS, arNum } from "@/lib/quran";
import { normalizeArabic, searchQuran, type SearchRow } from "@/lib/quran/search";
import { unwrap } from "@/lib/unwrap";

type Indexed = { norm: string; row: SearchRow };
let indexPromise: Promise<Indexed[]> | null = null;
function loadIndex(): Promise<Indexed[]> {
  indexPromise ??= fetch("/quran/search.json")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<SearchRow[]>;
    })
    .then((rows) => rows.map((row) => ({ norm: normalizeArabic(row[3]), row })))
    .catch((e) => {
      indexPromise = null;
      throw e;
    });
  return indexPromise;
}

type BookmarkRow = { id: string; surah: number; aya: number; page: number; note: string | null; created_at: string };

const readerHref = (page: number, surah: number, aya: number) => `/app/quran/read?page=${page}&aya=${surah}:${aya}`;

export function QuranLibrary({ bookmarks, initialTab }: { bookmarks: BookmarkRow[]; initialTab: "search" | "bookmarks" }) {
  const [index, setIndex] = useState<Indexed[] | null>(null);
  const [indexFailed, setIndexFailed] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);

  useEffect(() => {
    let alive = true;
    loadIndex()
      .then((i) => alive && setIndex(i))
      .catch(() => alive && setIndexFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const { hits, total } = index ? searchQuran(index, deferred) : { hits: [], total: 0 };
  const textOf = (surah: number, aya: number) => index?.find((x) => x.row[0] === surah && x.row[1] === aya)?.row[3];

  return (
    <Tabs defaultValue={initialTab}>
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="search">البحث</TabsTrigger>
        <TabsTrigger value="bookmarks">علاماتي{bookmarks.length > 0 && ` (${arNum(bookmarks.length)})`}</TabsTrigger>
      </TabsList>

      <TabsContent value="search" className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="اكتب كلمة أو جزءاً من آية"
            className="h-11 ps-9 text-base"
            autoFocus
            aria-label="البحث في القرآن"
          />
        </div>

        {indexFailed ? (
          <p className="text-sm text-destructive">تعذّر تحميل فهرس البحث، تحقّق من الاتصال وأعد فتح الصفحة.</p>
        ) : !index ? (
          <p className="text-sm text-muted-foreground">جارٍ تحميل فهرس البحث…</p>
        ) : normalizeArabic(deferred).length < 2 ? (
          <p className="text-sm text-muted-foreground">اكتب حرفين على الأقل. البحث لا يتأثر بالتشكيل ولا بأشكال الهمزة.</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد نتائج لـ «{deferred}»</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {arNum(total)} نتيجة{total > hits.length && ` (أول ${arNum(hits.length)})`}
            </p>
            <ul className="flex flex-col gap-2">
              {hits.map((h) => (
                <li key={`${h.surah}:${h.aya}`}>
                  <Link
                    href={readerHref(h.page, h.surah, h.aya)}
                    className="flex flex-col gap-1.5 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="text-xs text-muted-foreground">
                      {SURAHS[h.surah - 1].name} — الآية {arNum(h.aya)} · ص {arNum(h.page)}
                    </span>
                    <span className="leading-loose">
                      {h.text.slice(0, h.start)}
                      <mark className="rounded bg-gold/30 px-0.5 text-foreground">{h.text.slice(h.start, h.end)}</mark>
                      {h.text.slice(h.end)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </TabsContent>

      <TabsContent value="bookmarks" className="flex flex-col gap-3">
        {bookmarks.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <BookmarkX />
            </EmptyMedia>
            <EmptyTitle>لا توجد آيات محفوظة بعد</EmptyTitle>
            <EmptyDescription>اضغط أي آية في المصحف ثم «احفظ في علاماتي» لترجع إليها هنا.</EmptyDescription>
          </Empty>
        ) : (
          bookmarks.map((b) => <BookmarkCard key={b.id} bookmark={b} text={textOf(b.surah, b.aya)} />)
        )}
      </TabsContent>
    </Tabs>
  );
}

function BookmarkCard({ bookmark: b, text }: { bookmark: BookmarkRow; text: string | undefined }) {
  const [note, setNote] = useState(b.note ?? "");
  const [isPending, startTransition] = useTransition();

  function saveNote() {
    if (note.trim() === (b.note ?? "")) return;
    startTransition(async () => {
      try {
        await unwrap(updateBookmarkNote(b.id, note));
        toast.success("حُفظت الملاحظة");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await unwrap(deleteBookmark(b.id));
        toast.success("أُزيلت الآية من علاماتك");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الحذف");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <Link href={readerHref(b.page, b.surah, b.aya)} className="text-sm font-medium hover:underline">
          {SURAHS[b.surah - 1].name} — الآية {arNum(b.aya)} · ص {arNum(b.page)}
        </Link>
        <Button variant="ghost" size="icon-sm" onClick={remove} disabled={isPending} aria-label="إزالة من العلامات">
          <BookmarkX />
        </Button>
      </div>
      {text && <p className="leading-loose text-muted-foreground">{text}</p>}
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        rows={2}
        maxLength={500}
        placeholder="ملاحظتك على الآية (تُحفظ تلقائياً)"
        className="text-sm"
      />
    </div>
  );
}
