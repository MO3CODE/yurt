"use client";

import { useEffect, useRef } from "react";
import { UnitNavBar, useUnitCompletion } from "@/components/learning/unit-completion";

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
  const holder = useRef<HTMLDivElement | null>(null);
  const completion = useUnitCompletion({ unitId, courseId, initialDone, nextHref });
  const markDoneRef = useRef(completion.markDone);
  useEffect(() => {
    markDoneRef.current = completion.markDone;
  });

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
        events: { onStateChange: (e) => e.data === YT_ENDED && markDoneRef.current("اكتمل الدرس ✓") },
      });
    });
    return () => {
      alive = false;
      player?.destroy();
    };
  }, [videoId]);

  return (
    <div className="flex flex-col gap-3">
      {videoId && (
        <div className="overflow-hidden rounded-2xl bg-black shadow-soft">
          <div ref={holder} className="aspect-video w-full [&_iframe]:size-full" />
        </div>
      )}
      <UnitNavBar
        done={completion.done}
        isPending={completion.isPending}
        onComplete={() => completion.markDone()}
        onUndo={completion.undo}
        nextHref={nextHref}
        prevHref={prevHref}
      />
    </div>
  );
}
