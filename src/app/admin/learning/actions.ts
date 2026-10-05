"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { COURSE_CATEGORIES, COURSE_LEVELS, youtubeThumb } from "@/lib/learning";
import { fetchPlaylist, fetchVideoTitle, parsePlaylistId, parseVideoId } from "@/lib/learning/youtube";

const courseSchema = z.object({
  title: z.string().trim().min(2, "اكتب عنوان الكورس").max(120),
  category: z.enum(COURSE_CATEGORIES.map((c) => c.key) as [string, ...string[]], { message: "اختر القسم" }),
  level: z.enum(COURSE_LEVELS.map((l) => l.key) as [string, ...string[]]).nullable(),
  description: z.string().trim().max(4000).nullable(),
});

function parseCourse(formData: FormData) {
  return courseSchema.parse({
    title: formData.get("title"),
    category: formData.get("category"),
    level: formData.get("level") || null,
    description: formData.get("description") || null,
  });
}

function refresh(courseId?: string) {
  revalidatePath("/admin/learning");
  if (courseId) revalidatePath(`/admin/learning/${courseId}`);
  revalidatePath("/app/learn", "layout");
}

export async function createCourse(formData: FormData) {
  return runAction(async () => {
    const user = await assertPermission("learning");
    const v = parseCourse(formData);
    const supabase = await createClient();
    const { data, error } = await supabase.from("courses").insert({ ...v, created_by: user.id }).select("id").single();
    if (error) throw new Error(error.message);
    refresh();
    return { id: data.id };
  });
}

export async function updateCourse(courseId: string, formData: FormData) {
  return runAction(async () => {
    await assertPermission("learning");
    const v = parseCourse(formData);
    const supabase = await createClient();
    const { error } = await supabase
      .from("courses")
      .update({ ...v, updated_at: new Date().toISOString() })
      .eq("id", z.string().uuid().parse(courseId));
    if (error) throw new Error(error.message);
    refresh(courseId);
  });
}

export async function setCoursePublished(courseId: string, published: boolean) {
  return runAction(async () => {
    await assertPermission("learning");
    const supabase = await createClient();
    if (published) {
      const { count } = await supabase.from("course_units").select("id", { count: "exact", head: true }).eq("course_id", courseId);
      if (!count) throw new Error("أضف درساً واحداً على الأقل قبل النشر");
    }
    const { error } = await supabase.from("courses").update({ published, updated_at: new Date().toISOString() }).eq("id", courseId);
    if (error) throw new Error(error.message);
    refresh(courseId);
  });
}

export async function deleteCourse(courseId: string) {
  return runAction(async () => {
    await assertPermission("learning");
    const supabase = await createClient();
    const { error } = await supabase.from("courses").delete().eq("id", z.string().uuid().parse(courseId));
    if (error) throw new Error(error.message);
    refresh();
  });
}

async function nextPosition(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string) {
  const { data } = await supabase
    .from("course_units")
    .select("position")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

/** يستورد كل فيديوهات البلاي ليست بعد الوحدات الموجودة (ويتجاهل المكرر)، ويضبط الغلاف إن لم يكن */
export async function importPlaylist(courseId: string, url: string) {
  return runAction(async () => {
    await assertPermission("learning");
    const playlistId = parsePlaylistId(url);
    if (!playlistId) throw new Error("الرابط ليس رابط بلاي ليست يوتيوب (يجب أن يحتوي list=)");

    const playlist = await fetchPlaylist(playlistId);
    if (playlist.videos.length === 0) throw new Error("البلاي ليست فارغة أو كل فيديوهاتها خاصة");

    const supabase = await createClient();
    const [{ data: course }, { data: existing }] = await Promise.all([
      supabase.from("courses").select("cover_url, description, youtube_playlist_id").eq("id", courseId).single(),
      supabase.from("course_units").select("youtube_video_id").eq("course_id", courseId),
    ]);
    const have = new Set((existing ?? []).map((u) => u.youtube_video_id));
    const fresh = playlist.videos.filter((v) => !have.has(v.videoId));

    let position = await nextPosition(supabase, courseId);
    if (fresh.length > 0) {
      const { error } = await supabase.from("course_units").insert(
        fresh.map((v) => ({
          course_id: courseId,
          position: position++,
          kind: "video",
          title: v.title.slice(0, 200),
          youtube_video_id: v.videoId,
          duration_seconds: v.durationSeconds,
        }))
      );
      if (error) throw new Error(error.message);
    }

    await supabase
      .from("courses")
      .update({
        cover_url: course?.cover_url ?? playlist.thumbnail ?? youtubeThumb(playlist.videos[0].videoId),
        description: course?.description || playlist.description.slice(0, 4000) || null,
        youtube_playlist_id: course?.youtube_playlist_id ?? playlistId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", courseId);

    refresh(courseId);
    return { added: fresh.length, skipped: playlist.videos.length - fresh.length };
  });
}

/** فيديو منفرد برابطه (بلا مفتاح API، بلا مدة) */
export async function addVideoUnit(courseId: string, url: string) {
  return runAction(async () => {
    await assertPermission("learning");
    const videoId = parseVideoId(url);
    if (!videoId) throw new Error("الرابط ليس رابط فيديو يوتيوب");
    const title = await fetchVideoTitle(videoId);
    const supabase = await createClient();
    const position = await nextPosition(supabase, courseId);
    const { error } = await supabase
      .from("course_units")
      .insert({ course_id: courseId, position, kind: "video", title: title.slice(0, 200), youtube_video_id: videoId });
    if (error) throw new Error(error.message);
    const { data: course } = await supabase.from("courses").select("cover_url").eq("id", courseId).single();
    if (!course?.cover_url) await supabase.from("courses").update({ cover_url: youtubeThumb(videoId) }).eq("id", courseId);
    refresh(courseId);
  });
}

export async function renameUnit(unitId: string, courseId: string, title: string) {
  return runAction(async () => {
    await assertPermission("learning");
    const t = z.string().trim().min(1, "العنوان فارغ").max(200).parse(title);
    const supabase = await createClient();
    const { error } = await supabase.from("course_units").update({ title: t }).eq("id", unitId);
    if (error) throw new Error(error.message);
    refresh(courseId);
  });
}

export async function deleteUnit(unitId: string, courseId: string) {
  return runAction(async () => {
    await assertPermission("learning");
    const supabase = await createClient();
    const { error } = await supabase.from("course_units").delete().eq("id", unitId);
    if (error) throw new Error(error.message);
    refresh(courseId);
  });
}

/** نقل وحدة خطوة للأعلى أو الأسفل بتبديل موضعها مع جارتها */
export async function moveUnit(unitId: string, courseId: string, direction: "up" | "down") {
  return runAction(async () => {
    await assertPermission("learning");
    const supabase = await createClient();
    const { data: units, error } = await supabase.from("course_units").select("id, position").eq("course_id", courseId).order("position");
    if (error) throw new Error(error.message);
    const i = (units ?? []).findIndex((u) => u.id === unitId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= units!.length) return;
    const a = units![i];
    const b = units![j];
    const [r1, r2] = await Promise.all([
      supabase.from("course_units").update({ position: b.position }).eq("id", a.id),
      supabase.from("course_units").update({ position: a.position }).eq("id", b.id),
    ]);
    if (r1.error || r2.error) throw new Error((r1.error ?? r2.error)!.message);
    refresh(courseId);
  });
}

const pointsSchema = z.object({
  course_complete: z.coerce.number().int().min(0).max(1000),
  writing_approved: z.coerce.number().int().min(0).max(1000),
});

export async function saveLearningPointsSettings(formData: FormData) {
  return runAction(async () => {
    await assertPermission("learning");
    const v = pointsSchema.parse(Object.fromEntries(formData));
    const supabase = await createClient();
    const { error } = await supabase.from("learning_points_settings").update({ ...v, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/learning");
  });
}
