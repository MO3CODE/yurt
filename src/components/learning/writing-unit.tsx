"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, CheckCircle2, ImagePlus, MessageSquareText, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { submitWriting } from "@/app/app/learn/actions";
import { arNum } from "@/lib/quran";
import { MAX_IMAGES, WRITING_BUCKET, WRITING_STATUS_LABELS, type WritingStatus } from "@/lib/learning/writing";

export type SubmissionView = {
  id: string;
  topic: string;
  status: WritingStatus;
  feedback: string | null;
  note: string | null;
  createdAt: string;
  images: string[];
};

const STATUS_TONE: Record<WritingStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-success/15 text-success",
  revise: "bg-warning/20 text-warning-foreground dark:text-warning",
};

/** تصغير الصورة قبل الرفع (أطول ضلع ١٦٠٠ بكسل، JPEG) */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("تعذّر تجهيز الصورة"))), "image/jpeg", 0.82)
  );
}

export function WritingUnit({
  unitId,
  userId,
  instructions,
  topics,
  submissions,
}: {
  unitId: string;
  userId: string;
  instructions: string | null;
  topics: string[];
  submissions: SubmissionView[];
}) {
  const router = useRouter();
  const [topic, setTopic] = useState<string | null>(topics.length === 1 ? topics[0] : null);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const awaiting = submissions.some((s) => s.status === "pending");
  const approved = submissions.some((s) => s.status === "approved");

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = [...list].filter((f) => f.type.startsWith("image/")).slice(0, MAX_IMAGES - files.length);
    const added = picked.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { file, url };
    });
    setFiles((prev) => [...prev, ...added]);
    if (input.current) input.current.value = "";
  }

  function submit() {
    if (!topic) return toast.error("اختر الموضوع أولاً");
    if (files.length === 0) return toast.error("ارفع صورة ورقتك");
    startTransition(async () => {
      try {
        const supabase = createClient();
        const stamp = Date.now();
        const paths: string[] = [];
        for (const [i, { file }] of files.entries()) {
          setStage(`رفع الصورة ${arNum(i + 1)} من ${arNum(files.length)}…`);
          const blob = await compress(file);
          const path = `${userId}/${unitId}/${stamp}-${i + 1}.jpg`;
          const { error } = await supabase.storage.from(WRITING_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
          if (error)
            throw new Error(
              error.message.includes("row-level security")
                ? "انتهت جلستك أو لا تملك صلاحية الرفع، أعد تسجيل الدخول ثم حاول"
                : `تعذّر رفع الصورة: ${error.message}`
            );
          paths.push(path);
        }
        setStage("إرسال للمراجعة…");
        const r = await submitWriting({ unitId, topic, paths, note: note.trim() || null });
        if (!r.ok) throw new Error(r.error);
        toast.success("أُرسلت كتابتك للمراجعة، ستصلك الملاحظات هنا وفي الإشعارات");
        files.forEach((f) => URL.revokeObjectURL(f.url));
        setFiles([]);
        setNote("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذّر الإرسال");
      } finally {
        setStage(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {instructions && <p className="whitespace-pre-line rounded-xl border bg-card p-4 leading-relaxed">{instructions}</p>}

      {submissions.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="text-sm font-medium">تسليماتك</span>
          {submissions.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium" dir="auto">
                  {s.topic}
                </span>
                <Badge className={STATUS_TONE[s.status]}>{WRITING_STATUS_LABELS[s.status]}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {s.images.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border">
                    {/* روابط موقّعة مؤقتة من مخزن خاص */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`الصفحة ${arNum(i + 1)}`} className="size-20 object-cover" />
                  </a>
                ))}
              </div>
              {s.feedback && (
                <p className="flex gap-2 rounded-lg bg-muted/60 p-2.5 text-sm leading-relaxed">
                  <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="whitespace-pre-line" dir="auto">
                    {s.feedback}
                  </span>
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {approved ? (
        <p className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="size-4" /> قُبلت كتابتك في هذا التدريب، بارك الله فيك.
        </p>
      ) : awaiting ? (
        <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">كتابتك بانتظار المراجعة، ستصلك الملاحظات قريباً.</p>
      ) : (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">١. اختر الموضوع</span>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="الموضوع">
              {topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={topic === t}
                  onClick={() => setTopic(t)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-start text-sm transition-colors",
                    topic === t ? "border-primary bg-primary/8 font-medium" : "hover:bg-muted/50"
                  )}
                  dir="auto"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">٢. اكتب بيدك على ورقة، ثم صوّرها وارفعها</span>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={f.url} className="relative overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`الصفحة ${arNum(i + 1)}`} className="size-24 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(f.url);
                      setFiles((prev) => prev.filter((x) => x.url !== f.url));
                    }}
                    className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                    aria-label="إزالة الصورة"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {files.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50"
                >
                  {files.length === 0 ? <Camera className="size-5" /> : <ImagePlus className="size-5" />}
                  {files.length === 0 ? "صوّر الورقة" : "صفحة أخرى"}
                </button>
              )}
            </div>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">٣. ملاحظة للمراجع (اختياري)</span>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="مثلاً: لم أفهم متى أستعمل الماضي التام" />
          </div>

          <Button onClick={submit} disabled={isPending || !topic || files.length === 0} className="w-fit">
            {isPending ? <Spinner /> : <Send />}
            {stage ?? "أرسل للمراجعة"}
          </Button>
        </section>
      )}
    </div>
  );
}
