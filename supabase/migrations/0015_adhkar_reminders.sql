-- ============================================================================
-- أذكار الصباح والمساء + تذكيرات الأذكار والورد
-- ============================================================================

-- إتمام الأذكار: صف لكل طالب/يوم/فترة
create table public.adhkar_logs (
  student_id uuid not null references public.students (id) on delete cascade,
  record_date date not null,
  period text not null check (period in ('morning', 'evening')),
  -- counter: أتمّها بالعدّاد في المنصة، manual: قرأها من كتيّب أو حفظه
  method text not null default 'counter' check (method in ('counter', 'manual')),
  completed_at timestamptz not null default now(),
  primary key (student_id, record_date, period)
);

alter table public.adhkar_logs enable row level security;

create policy adhkar_logs_select on public.adhkar_logs for select
  using (student_id = (select auth.uid()) or (select public.has_permission('quran')) or public.supervises_student(student_id));

create policy adhkar_logs_insert_own on public.adhkar_logs for insert
  with check (student_id = (select auth.uid()));

-- إعدادات التذكير (في نفس صف إعدادات الصلاة). null = التذكير موقوف
alter table public.prayer_reminder_settings
  add column adhkar_morning_minutes smallint default 15
    check (adhkar_morning_minutes is null or adhkar_morning_minutes in (10, 15, 20, 30, 45)),
  add column adhkar_evening_minutes smallint default 15
    check (adhkar_evening_minutes is null or adhkar_evening_minutes in (10, 15, 20, 30, 45)),
  add column wird_prayer text default 'isha'
    check (wird_prayer is null or wird_prayer in ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  add column wird_minutes smallint not null default 30
    check (wird_minutes in (0, 15, 30, 60, 90));

-- سجل إرسال تذكيرات الأذكار والورد (يمنع التكرار؛ للسيرفر فقط)
create table public.devotion_push_log (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('adhkar_morning', 'adhkar_evening', 'wird')),
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (profile_id, kind, day)
);

alter table public.devotion_push_log enable row level security;
-- بلا أي سياسة: لا يقرؤه ولا يكتبه إلا السيرفر (service role)

create index idx_devotion_push_log_day on public.devotion_push_log (day);
