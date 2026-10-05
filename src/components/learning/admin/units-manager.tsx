"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, ListVideo, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { addVideoUnit, deleteUnit, importPlaylist, moveUnit, renameUnit } from "@/app/admin/learning/actions";
import { arNum } from "@/lib/quran";
import { UNIT_KIND_LABELS, formatDuration, unitsLabel, type UnitKind } from "@/lib/learning";
import { unwrap } from "@/lib/unwrap";

export type AdminUnit = { id: string; title: string; kind: UnitKind; durationSeconds: number | null };

/** استيراد البلاي ليست، إضافة فيديو برابط، وإدارة ترتيب الدروس وعناوينها */
export function UnitsManager({ courseId, units }: { courseId: string; units: AdminUnit[] }) {
  const router = useRouter();
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    startTransition(async () => {
      try {
        await task();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر ذلك");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <form
          className="flex flex-col gap-2 rounded-xl border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run("playlist", async () => {
              const r = await unwrap(importPlaylist(courseId, playlistUrl));
              toast.success(
                r.added > 0
                  ? `أُضيف ${unitsLabel(r.added)}${r.skipped ? ` (تُجوهل ${arNum(r.skipped)} موجود مسبقاً)` : ""}`
                  : "كل فيديوهات البلاي ليست موجودة مسبقاً"
              );
              setPlaylistUrl("");
            });
          }}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <ListVideo className="size-4" /> استيراد بلاي ليست يوتيوب
          </span>
          <div className="flex gap-2">
            <Input
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              placeholder="https://www.youtube.com/playlist?list=…"
              dir="ltr"
              aria-label="رابط البلاي ليست"
            />
            <Button type="submit" disabled={!playlistUrl.trim() || busy !== null}>
              {busy === "playlist" && <Spinner />}
              استيراد
            </Button>
          </div>
          <span className="text-[11px] text-muted-foreground">تُضاف الفيديوهات بعناوينها ومددها وترتيبها، ويُتجاهل المكرر.</span>
        </form>

        <form
          className="flex flex-col gap-2 rounded-xl border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run("video", async () => {
              await unwrap(addVideoUnit(courseId, videoUrl));
              toast.success("أُضيف الدرس");
              setVideoUrl("");
            });
          }}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Plus className="size-4" /> إضافة فيديو برابطه
          </span>
          <div className="flex gap-2">
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtu.be/…"
              dir="ltr"
              aria-label="رابط الفيديو"
            />
            <Button type="submit" variant="outline" disabled={!videoUrl.trim() || busy !== null}>
              {busy === "video" && <Spinner />}
              إضافة
            </Button>
          </div>
          <span className="text-[11px] text-muted-foreground">يعمل بلا مفتاح يوتيوب، لكن بلا مدة الفيديو.</span>
        </form>
      </div>

      {units.length > 0 && (
        <ol className="flex flex-col divide-y rounded-2xl border bg-card">
          {units.map((u, i) => (
            <li key={u.id} className="flex items-center gap-2 px-3 py-2">
              <span className="w-7 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{arNum(i + 1)}</span>
              {editing?.id === u.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(`rename-${u.id}`, async () => {
                      await unwrap(renameUnit(u.id, courseId, editing.title));
                      setEditing(null);
                    });
                  }}
                >
                  <Input value={editing.title} onChange={(e) => setEditing({ id: u.id, title: e.target.value })} autoFocus className="h-8" />
                  <Button type="submit" size="icon-sm" aria-label="حفظ العنوان">
                    <Check />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => setEditing(null)} aria-label="إلغاء">
                    <X />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{u.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {UNIT_KIND_LABELS[u.kind]}
                      {u.durationSeconds ? ` · ${formatDuration(u.durationSeconds)}` : ""}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="تحريك للأعلى"
                      disabled={i === 0 || busy !== null}
                      onClick={() => run(`up-${u.id}`, () => unwrap(moveUnit(u.id, courseId, "up")))}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="تحريك للأسفل"
                      disabled={i === units.length - 1 || busy !== null}
                      onClick={() => run(`down-${u.id}`, () => unwrap(moveUnit(u.id, courseId, "down")))}
                    >
                      <ArrowDown />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="تعديل العنوان" onClick={() => setEditing({ id: u.id, title: u.title })}>
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="حذف الدرس"
                      className="text-destructive"
                      disabled={busy !== null}
                      onClick={() => {
                        if (window.confirm(`حذف «${u.title}»؟ يُحذف معه تقدّم الطلاب فيه.`))
                          run(`del-${u.id}`, () => unwrap(deleteUnit(u.id, courseId)));
                      }}
                    >
                      {busy === `del-${u.id}` ? <Spinner /> : <Trash2 />}
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
