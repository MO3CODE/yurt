import type { Json } from "@/lib/supabase/types";

// تدريبات الكتابة: مواضيع يختار الطالب منها، يكتب على الورق ويرفع صوره، والإدارة تراجع

export const WRITING_BUCKET = "learning-submissions";
export const MAX_IMAGES = 6;

export type WritingStatus = "pending" | "approved" | "revise";
export const WRITING_STATUS_LABELS: Record<WritingStatus, string> = {
  pending: "بانتظار المراجعة",
  approved: "مقبول ✓",
  revise: "يحتاج إعادة",
};

/** content في جدول course_units لوحدات الكتابة: {"topics": ["..."]} */
export function writingTopics(content: Json | null): string[] {
  if (!content || typeof content !== "object" || Array.isArray(content)) return [];
  const topics = (content as { topics?: unknown }).topics;
  return Array.isArray(topics) ? topics.filter((t): t is string => typeof t === "string" && t.trim().length > 0) : [];
}

/** المواضيع من نص (موضوع في كل سطر) */
export function parseTopics(text: string): string[] {
  return [...new Set(text.split("\n").map((t) => t.trim()).filter(Boolean))].slice(0, 30);
}
