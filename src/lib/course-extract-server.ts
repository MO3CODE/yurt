import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// قراءة مواد الطالب من صورة (لقطة من تطبيق الجامعة، أو جدول المحاضرات، أو كشف التسجيل) بنموذج Claude.
// يحتاج ANTHROPIC_API_KEY في متغيرات البيئة.

const ExtractedSchema = z.object({
  courses: z.array(
    z.object({
      name: z.string().describe("اسم المادة كما هو مكتوب في الصورة، بلغته الأصلية"),
      code: z.string().nullable().describe("رمز المادة إن ظهر"),
      instructor: z.string().nullable().describe("اسم الأستاذ بالأحرف العادية (Title Case) لا الكبيرة كلها"),
      credits: z.number().nullable().describe("الساعات المعتمدة (CREDIT / AKTS) إن ظهرت"),
      currentTerm: z.boolean().describe("false للمواد غير الفصلية أو القديمة مثل السنة التحضيرية Hazırlık / Non-Term Courses"),
    })
  ),
  termLabel: z.string().nullable().describe("الفصل الظاهر في الصورة، مثل 2026-2027 Güz"),
  looksCutOff: z.boolean().describe("true إن بدت القائمة مقطوعة (مادة نصف ظاهرة في أسفل الصورة أو بلا تفاصيل)"),
});

export type ExtractedCourses = z.infer<typeof ExtractedSchema>;

const PROMPT = `هذه صورة (أو صور) من نظام جامعة تركية لطالب: قائمة مواده أو جدول محاضراته الأسبوعي أو كشف تسجيله.
استخرج كل مادة مرة واحدة فقط (المادة المتكررة في الجدول بأيام أو قاعات مختلفة مادة واحدة).
- اكتب اسم المادة كما هو تماماً (لا تترجمه).
- اكتب اسم الأستاذ بحالة الأحرف العادية مع الحروف التركية الصحيحة، مثل «Zehra Aydın» لا «ZEHRA AYDIN»، و«Göknur Akçadağ».
- إن ظهر أكثر من أستاذ لمادة واحدة اكتبهم مفصولين بفاصلة.
- النِّسب المئوية الظاهرة بجانب المواد هي تقدّم في المحتوى، وليست درجات: تجاهلها.
- المواد من خارج الفصل الحالي (السنة التحضيرية Hazırlık، Non-Term Courses، فصول سابقة) اجعل currentTerm لها false.
- إن لم تجد أي مادة فأرجع قائمة فارغة.`;

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export async function extractCoursesFromFiles(files: File[]): Promise<ExtractedCourses> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("قراءة الصور غير مفعّلة بعد: أضف ANTHROPIC_API_KEY في إعدادات Vercel");
  if (files.length === 0) throw new Error("اختر صورة المواد");
  if (files.length > 4) throw new Error("حتى ٤ صور في المرة");

  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) throw new Error("الصورة أكبر من ٥ ميغابايت");
    const data = Buffer.from(await f.arrayBuffer()).toString("base64");
    if (f.type === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    } else if ((IMAGE_TYPES as readonly string[]).includes(f.type)) {
      blocks.push({ type: "image", source: { type: "base64", media_type: f.type as (typeof IMAGE_TYPES)[number], data } });
    } else {
      throw new Error("الملف صورة أو PDF فقط");
    }
  }
  blocks.push({ type: "text", text: PROMPT });

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      // إن رفض النموذج لسبب أمني (نادر هنا) يُعاد الطلب تلقائياً على نموذج بديل
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(ExtractedSchema) },
      messages: [{ role: "user", content: blocks }],
    });
    if (response.stop_reason === "refusal") throw new Error("تعذّرت قراءة الصورة — أدخل المواد يدوياً");
    if (!response.parsed_output) throw new Error("لم أفهم الصورة — جرّب لقطة أوضح");
    return response.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("مفتاح ANTHROPIC_API_KEY غير صحيح");
    if (e instanceof Anthropic.RateLimitError) throw new Error("ضغط على خدمة القراءة — حاول بعد دقيقة");
    if (e instanceof Anthropic.APIError) throw new Error(`تعذّرت قراءة الصورة (${e.status ?? "خطأ"})`);
    throw e;
  }
}
