"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookPlus, FolderPlus, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { addPackSets, createCourseFromPack } from "@/app/admin/learning/actions";
import { arNum } from "@/lib/quran";
import { LEVEL_LABELS } from "@/lib/learning";
import { speak } from "@/lib/learning/content";
import type { VocabPack } from "@/lib/learning/vocab-packs";
import { unwrap } from "@/lib/unwrap";

/** مكتبة الكلمات الجاهزة: استعراض المواضيع وكلماتها، وإنشاء كورس أو الإضافة لكورس موجود */
export function VocabLibrary({ packs, courses }: { packs: VocabPack[]; courses: { id: string; title: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function createFrom(level: string) {
    setBusy(`create-${level}`);
    startTransition(async () => {
      try {
        const r = await unwrap(createCourseFromPack(level));
        toast.success("أُنشئ الكورس مسودة، راجعه ثم انشره");
        router.push(`/admin/learning/${r.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الإنشاء");
        setBusy(null);
      }
    });
  }

  function addToCourse() {
    if (!target) return toast.error("اختر الكورس");
    setBusy("add");
    startTransition(async () => {
      try {
        const r = await unwrap(addPackSets(target, [...selected]));
        toast.success(`أُضيف ${arNum(r.added)} ${r.added === 1 ? "درس" : "دروس"} كلمات إلى الكورس`);
        setSelected(new Set());
        router.push(`/admin/learning/${target}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّرت الإضافة");
        setBusy(null);
      }
    });
  }

  const courseItems = courses.map((c) => ({ value: c.id, label: c.title }));

  return (
    <div className="flex flex-col gap-6">
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-3 shadow-soft backdrop-blur">
          <span className="text-sm">اخترت {arNum(selected.size)} موضوع</span>
          <Select value={target} onValueChange={(v) => setTarget(v)} items={courseItems}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={courses.length ? "اختر الكورس" : "لا توجد كورسات بعد"} />
            </SelectTrigger>
            <SelectContent>
              {courseItems.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addToCourse} disabled={busy !== null || !target}>
            {busy === "add" ? <Spinner /> : <FolderPlus />} أضف للكورس
          </Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            إلغاء
          </Button>
        </div>
      )}

      {packs.map((pack) => (
        <section key={pack.level} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-heading text-lg font-semibold">{LEVEL_LABELS[pack.level]}</h2>
              <p className="text-sm text-muted-foreground">{pack.description}</p>
            </div>
            <Button onClick={() => createFrom(pack.level)} disabled={busy !== null}>
              {busy === `create-${pack.level}` ? <Spinner /> : <BookPlus />} أنشئ كورساً من هذا المستوى
            </Button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
            {pack.sets.map((set) => (
              <details key={set.id} className="group rounded-xl border bg-card">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                  <Checkbox
                    checked={selected.has(set.id)}
                    onCheckedChange={() => toggle(set.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`اختيار ${set.title}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{set.title}</span>
                    <span className="text-xs text-muted-foreground">{arNum(set.words.length)} كلمة · اضغط للاستعراض</span>
                  </span>
                </summary>
                <ul className="flex max-h-72 flex-col divide-y overflow-y-auto border-t text-sm">
                  {set.words.map((w) => (
                    <li key={w.word} className="flex items-start gap-2 px-3 py-2">
                      <button type="button" onClick={() => speak(w.word)} className="mt-0.5 text-muted-foreground hover:text-foreground" aria-label={`انطق ${w.word}`}>
                        <Volume2 className="size-4" />
                      </button>
                      <span className="min-w-0">
                        <span dir="ltr" className="font-medium">
                          {w.word}
                        </span>{" "}
                        <span className="text-muted-foreground">— {w.meaning}</span>
                        <span className="block text-xs text-muted-foreground" dir="ltr">
                          {w.example}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
