"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_RECITER, isReciter, reciterName, type ReciterId, type Track } from "@/lib/quran/recitation";
import { SURAHS, arNum } from "@/lib/quran";

// القارئ المختار محفوظ في الجهاز
const RECITER_KEY = "quran-reciter";
const reciterListeners = new Set<() => void>();
function subscribeReciter(cb: () => void) {
  reciterListeners.add(cb);
  return () => {
    reciterListeners.delete(cb);
  };
}
function readReciter(): ReciterId {
  try {
    const v = localStorage.getItem(RECITER_KEY);
    return isReciter(v) ? v : DEFAULT_RECITER;
  } catch {
    return DEFAULT_RECITER;
  }
}
function writeReciter(id: ReciterId) {
  try {
    localStorage.setItem(RECITER_KEY, id);
  } catch {}
  reciterListeners.forEach((l) => l());
}

/** أزرار التحكم في شاشة القفل ومركز التحكم */
function updateMediaSession(track: Track, audio: HTMLAudioElement) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: `${SURAHS[track.surah - 1].name} — الآية ${arNum(track.aya)}`,
    artist: reciterName(readReciter()),
    album: "منصة السكن",
  });
  navigator.mediaSession.setActionHandler("play", () => void audio.play());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
}

export type RecitationState = { status: "idle" | "loading" | "playing" | "paused"; key: string | null };

/**
 * تشغيل آيات الصفحة واحدة تلو الأخرى بعنصر audio واحد.
 * عند انتهاء آخر آية يُستدعى onPageEnd (القارئ ينتقل للصفحة التالية ثم يستدعي play بمقاطعها).
 */
export function useRecitation({ onPageEnd, onError }: { onPageEnd: () => void; onError: () => void }) {
  const reciter = useSyncExternalStore(subscribeReciter, readReciter, () => DEFAULT_RECITER);
  const [state, setState] = useState<RecitationState>({ status: "idle", key: null });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const indexRef = useRef(0);
  const handlers = useRef({ onPageEnd, onError });

  useEffect(() => {
    handlers.current = { onPageEnd, onError };
  });

  function element(): HTMLAudioElement {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      a.addEventListener("ended", () => {
        indexRef.current += 1;
        if (indexRef.current < tracksRef.current.length) playCurrent();
        else handlers.current.onPageEnd();
      });
      a.addEventListener("error", () => {
        setState({ status: "idle", key: null });
        handlers.current.onError();
      });
      a.addEventListener("pause", () => {
        if (!a.ended) setState((s) => (s.status === "playing" ? { ...s, status: "paused" } : s));
      });
      a.addEventListener("play", () => setState((s) => (s.key ? { ...s, status: "playing" } : s)));
      audioRef.current = a;
    }
    return audioRef.current;
  }

  function playCurrent() {
    const track = tracksRef.current[indexRef.current];
    if (!track) return;
    const a = element();
    a.src = track.url;
    setState({ status: "loading", key: track.key });
    a.play()
      .then(() => setState({ status: "playing", key: track.key }))
      .catch(() => setState({ status: "idle", key: null }));

    // تحميل المقطع التالي مسبقاً حتى لا ينقطع الصوت بين الآيات
    const next = tracksRef.current[indexRef.current + 1];
    if (next) {
      preloadRef.current ??= new Audio();
      preloadRef.current.preload = "auto";
      preloadRef.current.src = next.url;
    }

    updateMediaSession(track, a);
  }

  /** يبدأ من مفتاح آية معيّن (أو أول الصفحة) */
  function play(tracks: Track[], fromKey?: string) {
    tracksRef.current = tracks;
    const i = fromKey ? tracks.findIndex((t) => t.key === fromKey) : 0;
    indexRef.current = Math.max(0, i);
    playCurrent();
  }

  function toggle() {
    const a = audioRef.current;
    if (!a || !state.key) return false;
    if (a.paused) void a.play();
    else a.pause();
    return true;
  }

  function stop() {
    audioRef.current?.pause();
    tracksRef.current = [];
    setState({ status: "idle", key: null });
  }

  /** تغيير القارئ أثناء التشغيل يعيد الآية الحالية بصوته */
  function changeReciter(id: ReciterId, retrack: (id: ReciterId) => Track[]) {
    writeReciter(id);
    if (state.key && state.status !== "idle") play(retrack(id), state.key);
  }

  // إيقاف الصوت عند مغادرة القارئ
  useEffect(() => () => audioRef.current?.pause(), []);

  return { reciter, state, play, toggle, stop, changeReciter };
}
