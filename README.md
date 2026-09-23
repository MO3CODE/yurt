# منصة متابعة السكن الطلابي

منصة شاملة لمتابعة طلاب السكن والشقق: الحضور الجامعي، الصلوات الخمس، الورد القرآني، السجل الصحي، الدعم الأكاديمي، الشكاوى والمقترحات، جدول النظافة، المرافق العامة، النقاط والتحفيز، الإشعارات، والتقارير الرسمية للجهة المانحة.

**الأدوار:** إدارة عليا / إداري بصلاحيات محددة / مشرف شقة (طالب) / طالب.

## التقنيات

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (نمط base-nova على Base UI) — تصميم عربي RTL كامل
- **Supabase** (Postgres + Auth + Storage) لكل البيانات والصلاحيات (RLS)
- **PWA** بسيطة (قابلة للتثبيت من المتصفح على الجوال) + إشعارات Push عبر Web Push
- استضافة: **Vercel**

## خطوات التشغيل الأول

### ١. إنشاء مشروع Supabase

أنشئ حساباً ومشروعاً جديداً على [supabase.com](https://supabase.com) (هذه الخطوة تحتاج منك أنت شخصياً — تسجيل حساب لا يقوم به أحد نيابة عنك).

### ٢. تطبيق المخطط (Migrations)

من لوحة تحكم Supabase → **SQL Editor**، نفّذ الملفات التالية بالترتيب من مجلد `supabase/migrations/`:

1. `0001_init_schema.sql` — الجداول والأنواع والفهارس
2. `0002_functions_rls.sql` — دوال الصلاحيات وسياسات RLS
3. `0003_views_storage.sql` — لوحة صحة السكن، لوحة النقاط، ملف الطالب الشامل، حاويات التخزين

أو عبر Supabase CLI إذا كنت تفضّله:

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
```

### ٣. متغيرات البيئة

انسخ `.env.local.example` إلى `.env.local` وعبّي القيم من **Project Settings → API** في Supabase:

```bash
cp .env.local.example .env.local
```

### ٤. توليد أنواع TypeScript (اختياري لكن مستحسن)

الملف `src/lib/supabase/types.ts` مكتوب يدوياً ليطابق المخطط الحالي. بعد ربط مشروعك الحقيقي، ولّده تلقائياً بدل الملف اليدوي:

```bash
npx supabase gen types typescript --project-id <PROJECT_REF> > src/lib/supabase/types.ts
```

### ٥. إنشاء أول حساب إداري (مدير عام)

من **Authentication → Users** في Supabase، أنشئ مستخدماً جديداً بالبريد الإلكتروني الذي تريده (مع تفعيل "Auto Confirm"). بعدها من **Table Editor → profiles**، عدّل صف هذا المستخدم واجعل `role = super_admin`. سجّل دخولك بهذا الحساب من `/login` وابدأ بإضافة الشقق والطلاب من لوحة التحكم — كل حساب طالب لاحق تُنشئه من داخل المنصة نفسها (صفحة "الطلاب") وسيصله بريد دعوة تلقائياً.

### ٦. التشغيل محلياً

```bash
npm install
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000).

## النشر على Vercel

اربط المستودع بمشروع Vercel وأضف نفس متغيرات البيئة الثلاثة من الخطوة ٣ في إعدادات المشروع على Vercel، ثم انشر.

## بنية المجلدات

```
src/app/(login, profile)        صفحات عامة
src/app/admin/*                 لوحة الإدارة (كل الوحدات)
src/app/app/*                   واجهة الطالب (+ /app/apartment لمشرف الشقة)
src/lib/supabase/*              عملاء Supabase (متصفح/سيرفر/صلاحيات كاملة) + الأنواع
src/lib/auth/current-user.ts    قراءة هوية المستخدم الحالي ودوره وصلاحياته
supabase/migrations/*           مخطط قاعدة البيانات الكامل
```
