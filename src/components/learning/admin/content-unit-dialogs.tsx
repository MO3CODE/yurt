"use client";

import { CrudDialog } from "@/components/crud-dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveReadingUnit, saveVocabUnit } from "@/app/admin/learning/actions";
import { cardsToLines, type GlossaryEntry, type VocabCard } from "@/lib/learning/content";

/** قراءة أو قصة: النص + كلمات مميّزة بمعانيها */
export function ReadingUnitDialog({
  courseId,
  unit,
  trigger,
}: {
  courseId: string;
  unit?: { id: string; title: string; body: string | null; glossary: GlossaryEntry[] };
  trigger: React.ReactNode;
}) {
  return (
    <CrudDialog
      trigger={trigger}
      title={unit ? "تعديل القراءة" : "قراءة أو قصة جديدة"}
      description="الكلمات المميّزة تظهر في النص بلون مختلف، ويضغط عليها الطالب ليرى معناها ويسمع نطقها"
      action={(fd) => saveReadingUnit(courseId, unit?.id ?? null, fd)}
      submitLabel={unit ? "حفظ" : "إضافة"}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="r-title">العنوان</FieldLabel>
          <Input id="r-title" name="title" required minLength={2} maxLength={200} defaultValue={unit?.title} placeholder="Story: The Lost Key" />
        </Field>
        <Field>
          <FieldLabel htmlFor="r-body">النص</FieldLabel>
          <Textarea id="r-body" name="body" rows={8} required minLength={20} maxLength={20000} defaultValue={unit?.body ?? ""} dir="auto" />
        </Field>
        <Field>
          <FieldLabel htmlFor="r-glossary">الكلمات المميّزة (اختياري)</FieldLabel>
          <Textarea
            id="r-glossary"
            name="glossary"
            rows={4}
            defaultValue={unit ? cardsToLines(unit.glossary) : ""}
            placeholder={"key | مفتاح\nsuddenly | فجأةً"}
            dir="auto"
          />
          <FieldDescription>سطر لكل كلمة: الكلمة | المعنى (يمكن اللصق من Excel)</FieldDescription>
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}

/** كلمات للحفظ: بطاقات يقلّبها الطالب */
export function VocabUnitDialog({
  courseId,
  unit,
  trigger,
}: {
  courseId: string;
  unit?: { id: string; title: string; cards: VocabCard[] };
  trigger: React.ReactNode;
}) {
  return (
    <CrudDialog
      trigger={trigger}
      title={unit ? "تعديل الكلمات" : "كلمات للحفظ"}
      description="يقلّب الطالب البطاقات ويسمع النطق، ويعلّم ما حفظه حتى يحفظها كلها"
      action={(fd) => saveVocabUnit(courseId, unit?.id ?? null, fd)}
      submitLabel={unit ? "حفظ" : "إضافة"}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="v-title">العنوان</FieldLabel>
          <Input id="v-title" name="title" required minLength={2} maxLength={200} defaultValue={unit?.title} placeholder="Vocabulary: Daily Life" />
        </Field>
        <Field>
          <FieldLabel htmlFor="v-cards">الكلمات</FieldLabel>
          <Textarea
            id="v-cards"
            name="cards"
            rows={10}
            required
            defaultValue={unit ? cardsToLines(unit.cards) : ""}
            placeholder={"wake up | يستيقظ | I wake up at 6 every day.\nbreakfast | الفطور | We have breakfast together."}
            dir="auto"
          />
          <FieldDescription>سطر لكل كلمة: الكلمة | المعنى | مثال (المثال اختياري، حتى ٢٠٠ كلمة، ويمكن اللصق من Excel)</FieldDescription>
        </Field>
      </FieldGroup>
    </CrudDialog>
  );
}
