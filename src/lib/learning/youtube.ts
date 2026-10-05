import "server-only";

// استيراد يوتيوب: البلاي ليست عبر YouTube Data API v3 (يحتاج YOUTUBE_API_KEY)، والفيديو المنفرد عبر oEmbed (بلا مفتاح)

const API = "https://www.googleapis.com/youtube/v3";

export function parsePlaylistId(input: string): string | null {
  const s = input.trim();
  try {
    const u = new URL(s);
    const list = u.searchParams.get("list");
    if (list && /^[\w-]{10,64}$/.test(list)) return list;
  } catch {
    // ليس رابطاً: ربما المعرّف نفسه
  }
  return /^(PL|UU|OL|FL|RD)[\w-]{10,62}$/.test(s) ? s : null;
}

export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname === "youtu.be") return u.pathname.slice(1, 12) || null;
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/** PT1H2M3S ← ثوانٍ */
export function parseIsoDuration(iso: string | undefined): number | null {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("مفتاح YouTube غير مضبوط بعد (YOUTUBE_API_KEY). أضفه في إعدادات Vercel، أو أضف الفيديوهات برابط كل فيديو.");
  return key;
}

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: apiKey() });
  const res = await fetch(`${API}/${path}?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (res.status === 404) throw new Error("لم يُعثر على البلاي ليست. تأكد أن الرابط صحيح وأنها عامة أو غير مدرجة (Unlisted).");
    throw new Error(`تعذّر الاتصال بيوتيوب: ${body?.error?.message ?? `HTTP ${res.status}`}`);
  }
  return res.json() as Promise<T>;
}

export type ImportedVideo = { videoId: string; title: string; durationSeconds: number | null };
export type ImportedPlaylist = { title: string; description: string; thumbnail: string | null; videos: ImportedVideo[] };

/** كل فيديوهات البلاي ليست بترتيبها، مع المدد؛ يتجاهل الخاصة والمحذوفة وغير القابلة للتضمين */
export async function fetchPlaylist(playlistId: string): Promise<ImportedPlaylist> {
  type Thumbs = Record<string, { url: string } | undefined>;
  const meta = await api<{ items: { snippet: { title: string; description: string; thumbnails: Thumbs } }[] }>("playlists", {
    part: "snippet",
    id: playlistId,
  });
  const info = meta.items[0]?.snippet;
  if (!info) throw new Error("لم يُعثر على البلاي ليست. تأكد أن الرابط صحيح وأنها عامة أو غير مدرجة (Unlisted).");

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await api<{ items: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    ids.push(...page.items.map((i) => i.contentDetails.videoId));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < 500);

  const details = new Map<string, ImportedVideo>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = await api<{
      items: { id: string; snippet: { title: string }; contentDetails: { duration: string }; status: { privacyStatus: string; embeddable: boolean } }[];
    }>("videos", { part: "snippet,contentDetails,status", id: ids.slice(i, i + 50).join(",") });
    for (const v of batch.items) {
      if (v.status.privacyStatus === "private" || !v.status.embeddable) continue;
      details.set(v.id, { videoId: v.id, title: v.snippet.title, durationSeconds: parseIsoDuration(v.contentDetails.duration) });
    }
  }

  const thumb = info.thumbnails.maxres ?? info.thumbnails.high ?? info.thumbnails.medium ?? info.thumbnails.default;
  return {
    title: info.title,
    description: info.description,
    thumbnail: thumb?.url ?? null,
    videos: ids.map((id) => details.get(id)).filter((v): v is ImportedVideo => Boolean(v)),
  };
}

/** عنوان فيديو منفرد بلا مفتاح API */
export async function fetchVideoTitle(videoId: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error("لم يُعثر على الفيديو، أو أنه خاص أو لا يسمح بالتضمين");
  const data = (await res.json()) as { title?: string };
  return data.title?.trim() || "درس فيديو";
}
