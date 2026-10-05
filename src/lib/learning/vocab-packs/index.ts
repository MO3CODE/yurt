import beginner from "./beginner.json";
import intermediate from "./intermediate.json";
import advanced from "./advanced.json";
import type { CourseLevel } from "@/lib/learning";
import type { VocabCard } from "@/lib/learning/content";

// مكتبة كلمات إنجليزية جاهزة (٣٠٠ كلمة) تُنشئ منها الإدارة كورسات أو تضيفها لكورس موجود

export type VocabSet = { id: string; title: string; words: VocabCard[] };
export type VocabPack = { level: CourseLevel; title: string; description: string; sets: VocabSet[] };

export const VOCAB_PACKS = [beginner, intermediate, advanced] as VocabPack[];

export function findPack(level: string): VocabPack | undefined {
  return VOCAB_PACKS.find((p) => p.level === level);
}

export function findSets(ids: string[]): VocabSet[] {
  const wanted = new Set(ids);
  return VOCAB_PACKS.flatMap((p) => p.sets).filter((s) => wanted.has(s.id));
}
