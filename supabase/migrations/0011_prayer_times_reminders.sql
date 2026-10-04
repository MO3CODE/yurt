-- =====================================================================
-- 0011 — أوقات الصلاة (باعجلار، إسطنبول) وتذكيراتها
--   • prayer_times: جدول الشؤون الدينية التركية، يُزامَن يومياً من التطبيق (service role فقط)
--   • prayer_reminder_settings: إعدادات كل مستخدم (قبل الأذان بكم دقيقة، التذكير بالتسجيل، أي الصلوات)
--   • prayer_push_log: سجل ما أُرسل فعلاً؛ المفتاح الأساسي يمنع تكرار الإشعار نفسه
--   • push_subscriptions: فهرس فريد على endpoint (جدول الاشتراكات موجود منذ البداية)
-- جدولة الإرسال (كل دقيقة) في ملف مستقل 0012 يُطبَّق بعد نشر الكود.
-- =====================================================================

create extension if not exists pg_net;

create table public.prayer_times (
  day date primary key,
  fajr time not null,
  sunrise time not null,
  dhuhr time not null,
  asr time not null,
  maghrib time not null,
  isha time not null,
  source text not null default 'diyanet' check (source = 'diyanet'),
  fetched_at timestamptz not null default now(),
  check (fajr < sunrise and sunrise < dhuhr and dhuhr < asr and asr < maghrib and maghrib < isha)
);

alter table public.prayer_times enable row level security;
-- قراءة لكل مستخدم مسجّل؛ لا سياسة كتابة (المزامنة بصلاحية service role)
create policy prayer_times_read on public.prayer_times for select
  using ((select auth.uid()) is not null);

create table public.prayer_reminder_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  enabled boolean not null default true,
  lead_minutes smallint not null default 0 check (lead_minutes in (0, 5, 10, 15, 30)),
  nudge_minutes smallint check (nudge_minutes is null or nudge_minutes in (20, 30, 45, 60)),
  prayers text[] not null default array['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
  updated_at timestamptz not null default now(),
  check (prayers <@ array['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']::text[])
);

alter table public.prayer_reminder_settings enable row level security;
create policy prayer_reminder_settings_own on public.prayer_reminder_settings for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create trigger touch_updated_at before update on public.prayer_reminder_settings
  for each row execute function public.touch_updated_at();

create table public.prayer_push_log (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  prayer text not null check (prayer in ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  kind text not null check (kind in ('adhan', 'nudge')),
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (profile_id, prayer, kind, day)
);

alter table public.prayer_push_log enable row level security;
-- بلا أي سياسة: لا يقرؤه ولا يكتبه إلا السيرفر (service role)

create index idx_prayer_push_log_day on public.prayer_push_log (day);

create unique index if not exists push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);
