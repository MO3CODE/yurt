"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { completeUnit, uncompleteUnit } from "@/app/app/learn/actions";
import { arNum } from "@/lib/quran";

// واجهة YouTube IFrame API (ما نحتاجه منها فقط)
type YTPlayer = { destroy: () => void };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number | string>;
      events?: { onStateChange?: (e: { data: number }) => void };
    }
  ) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  apiPromise ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

const YT_ENDED = 0;

export function UnitPlayer({
  unitId,
  courseId,
  videoId,
  done: initialDone,
  nextHref,
  prevHref,
}: {
  unitId: string;
  courseId: string;
  videoId: string | null;
  done: boolean;
  nextHref: string | null;
  prevHref: string | null;
}) {
  const router = useRouter();
  const holder = useRef<HTMLDivElement | null>(null);
  const [done, setDone] = useState(initialDone);
  const [isPending, startTransition] = useTransition();
  const doneRef = useRef(initialDone);

  function markDone(auto: boolean) {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
    startTransition(async () => {
      const r = await completeUnit(unitId, courseId);
      if (!r.ok) {
        doneRef.current = false;
        setDone(false);
        toast.error(r.error);
        return;
      }
      if (r.data.course_completed) {
        toast.success(`أنهيت الكورس كاملاً، بارك الله فيك!${r.data.points > 0 ? ` +${arNum(r.data.points)} نقطة` : ""}`);
      } else {
        toast.success(auto ? "اكتمل الدرس ✓" : "سُجّل الدرس مكتملاً", {
          action: nextHref ? { label: "الدرس التالي", onClick: () => router.push(nextHref) } : undefined,
        });
      }
      router.refresh();
    });
  }

  function undo() {
    startTransition(async () => {
      const r = await uncompleteUnit(unitId, courseId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      doneRef.current = false;
      setDone(false);
      router.refresh();
    });
  }

  // مشغّل يوتيوب: يُعلَّم الدرس مكتملاً عند انتهاء الفيديو
  useEffect(() => {
    if (!videoId || !holder.current) return;
    let player: YTPlayer | null = null;
    let alive = true;
    const el = document.createElement("div");
    holder.current.replaceChildren(el);
    loadYouTubeApi().then((YT) => {
      if (!alive) return;
      player = new YT.Player(el, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
        events: { onStateChange: (e) => e.data === YT_ENDED && markDone(true) },
      });
    });
    return () => {
      alive = false;
      player?.destroy();
    };
    // markDone يقرأ الحالة من ref، فلا حاجة لإعادة إنشاء المشغّل عند تغيّرها
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className="flex flex-col gap-3">
      {videoId && (
        <div className="overflow-hidden rounded-2xl bg-black shadow-soft">
          <div ref={holder} className="aspect-video w-full [&_iframe]:size-full" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {prevHref && (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={prevHref} />}>
              <ChevronRight /> السابق
            </Button>
          )}
          {nextHref && (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={nextHref} />}>
              التالي <ChevronLeft />
            </Button>
          )}
        </div>
        {done ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> مكتمل
            </span>
            <Button variant="ghost" size="sm" onClick={undo} disabled={isPending} className="text-muted-foreground">
              <RotateCcw /> إلغاء
            </Button>
          </div>
        ) : (
          <Button onClick={() => markDone(false)} disabled={isPending}>
            {isPending ? <Spinner /> : <CheckCircle2 />} أنهيت الدرس
          </Button>
        )}
      </div>
    </div>
  );
}
