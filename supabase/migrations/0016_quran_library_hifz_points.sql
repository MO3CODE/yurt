-- ============================================================================
-- الورد ٢: علامات الآيات، الحفظ والمراجعة، والنقاط التلقائية للورد والأذكار
-- ============================================================================

-- ---------------------------------------------------------------- العلامات
create table public.quran_bookmarks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  surah smallint not null check (surah between 1 and 114),
  aya smallint not null check (aya between 1 and 286),
  page smallint not null check (page between 1 and 604),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (student_id, surah, aya)
);

alter table public.quran_bookmarks enable row level security;
create policy quran_bookmarks_own on public.quran_bookmarks for all
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- ---------------------------------------------------------------- الحفظ
create table public.quran_hifz (
  student_id uuid not null references public.students (id) on delete cascade,
  surah smallint not null check (surah between 1 and 114),
  status text not null check (status in ('memorized', 'learning')),
  updated_at timestamptz not null default now(),
  primary key (student_id, surah)
);

alter table public.quran_hifz enable row level security;
create policy quran_hifz_select on public.quran_hifz for select
  using (student_id = (select auth.uid()) or (select public.has_permission('quran')) or public.supervises_student(student_id));
create policy quran_hifz_write_own on public.quran_hifz for all
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- ملخص لكل طالب للوحة الإدارة (بدل جلب صف لكل سورة)
create view public.quran_hifz_summary with (security_invoker = true) as
select student_id,
       count(*) filter (where status = 'memorized')::integer as memorized,
       count(*) filter (where status = 'learning')::integer as learning
from public.quran_hifz
group by student_id;

grant select on public.quran_hifz_summary to authenticated;

-- المراجعة: كم صفحة يومياً (null = موقوفة)، وموضعها في صفحات المحفوظ، وآخر يوم راجع فيه
alter table public.quran_progress
  add column review_pages smallint check (review_pages between 1 and 60),
  add column review_cursor integer not null default 0 check (review_cursor >= 0),
  add column last_review_date date;

create or replace function public.set_quran_review(p_pages integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.students where id = uid) then
    raise exception 'هذه الميزة للطلاب فقط';
  end if;
  if p_pages is not null and (p_pages < 1 or p_pages > 60) then
    raise exception 'صفحات المراجعة بين ١ و٦٠';
  end if;
  insert into public.quran_progress as qp (student_id, review_pages)
  values (uid, p_pages)
  on conflict (student_id) do update set review_pages = excluded.review_pages, updated_at = now();
end;
$$;

-- «راجعتها»: يتقدّم الموضع بعدد صفحات المراجعة، ويدور على المحفوظ (p_total = عدد صفحات المحفوظ)
create or replace function public.quran_review_done(p_total integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  next_cursor integer;
begin
  if uid is null or not exists (select 1 from public.students where id = uid) then
    raise exception 'هذه الميزة للطلاب فقط';
  end if;
  if p_total is null or p_total < 1 or p_total > 604 then
    raise exception 'لا توجد صفحات محفوظة للمراجعة';
  end if;
  update public.quran_progress
  set review_cursor = (review_cursor + coalesce(review_pages, 1)) % p_total,
      last_review_date = (now() at time zone 'Europe/Istanbul')::date,
      updated_at = now()
  where student_id = uid
  returning review_cursor into next_cursor;
  if next_cursor is null then
    raise exception 'حدد عدد صفحات المراجعة أولاً';
  end if;
  return next_cursor;
end;
$$;

-- ---------------------------------------------------------------- النقاط التلقائية
-- مفتاح فريد لكل نقطة تلقائية (مثل wird:<الطالب>:2026-10-05) يمنع منحها مرتين
alter table public.points_entries add column auto_key text unique;

create table public.quran_points_settings (
  id smallint primary key default 1 check (id = 1),
  wird_goal integer not null default 2 check (wird_goal between 0 and 1000),
  streak7 integer not null default 10 check (streak7 between 0 and 1000),
  streak30 integer not null default 50 check (streak30 between 0 and 1000),
  khatma integer not null default 100 check (khatma between 0 and 1000),
  adhkar integer not null default 1 check (adhkar between 0 and 1000),
  updated_at timestamptz not null default now()
);
insert into public.quran_points_settings (id) values (1) on conflict do nothing;

alter table public.quran_points_settings enable row level security;
create policy quran_points_settings_read on public.quran_points_settings for select
  using ((select auth.uid()) is not null);
create policy quran_points_settings_write on public.quran_points_settings for update
  using ((select public.has_permission('points')))
  with check ((select public.has_permission('points')));

-- يمنح الطالب الحالي ما استحقه ولم يأخذه بعد، ويرجع مجموع ما مُنح الآن.
-- اليوم المؤهَّل: من له هدف يومي يجب أن يبلغه (منصة + ورقي)، ومن لا هدف له تكفيه أي قراءة.
create or replace function public.award_quran_points()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Istanbul')::date;
  cfg public.quran_points_settings;
  prog public.quran_progress;
  goal integer;
  d date;
  total numeric;
  any_read boolean;
  streak integer := 0;
  awarded integer := 0;
  k integer;
  rec record;
begin
  if uid is null or not exists (select 1 from public.students where id = uid) then
    return 0;
  end if;
  select * into cfg from public.quran_points_settings where id = 1;
  select * into prog from public.quran_progress where student_id = uid;
  goal := prog.daily_goal;

  -- السلسلة: أيام متتالية مؤهَّلة تنتهي اليوم (حتى ٤٠٠ يوم)
  for d in select g::date from generate_series(today, today - 399, interval '-1 day') g loop
    select
      coalesce((select count(*) from public.quran_page_reads where student_id = uid and record_date = d), 0)
        + coalesce((select sum(coalesce(pages, 0)) from public.quran_wird_logs where student_id = uid and record_date = d), 0),
      exists (select 1 from public.quran_page_reads where student_id = uid and record_date = d)
        or exists (select 1 from public.quran_wird_logs where student_id = uid and record_date = d)
    into total, any_read;
    exit when not (case when goal is null then any_read else total >= goal end);
    streak := streak + 1;
  end loop;

  if streak >= 1 then
    if cfg.wird_goal > 0 then
      insert into public.points_entries (student_id, category, points, reason, auto_key)
      values (uid, 'quran', cfg.wird_goal, 'إتمام الورد اليومي', 'wird:' || uid || ':' || today)
      on conflict (auto_key) do nothing;
      if found then awarded := awarded + cfg.wird_goal; end if;
    end if;
    if streak % 7 = 0 and cfg.streak7 > 0 then
      insert into public.points_entries (student_id, category, points, reason, auto_key)
      values (uid, 'quran', cfg.streak7, 'سلسلة ورد ' || streak || case when streak <= 10 then ' أيام متتالية' else ' يوماً متتالياً' end, 'streak7:' || uid || ':' || today)
      on conflict (auto_key) do nothing;
      if found then awarded := awarded + cfg.streak7; end if;
    end if;
    if streak % 30 = 0 and cfg.streak30 > 0 then
      insert into public.points_entries (student_id, category, points, reason, auto_key)
      values (uid, 'quran', cfg.streak30, 'سلسلة ورد ' || streak || case when streak <= 10 then ' أيام متتالية' else ' يوماً متتالياً' end, 'streak30:' || uid || ':' || today)
      on conflict (auto_key) do nothing;
      if found then awarded := awarded + cfg.streak30; end if;
    end if;
  end if;

  if cfg.khatma > 0 and coalesce(prog.khatmas, 0) > 0 then
    for k in 1..prog.khatmas loop
      insert into public.points_entries (student_id, category, points, reason, auto_key)
      values (uid, 'quran', cfg.khatma, 'ختمة القرآن رقم ' || k, 'khatma:' || uid || ':' || k)
      on conflict (auto_key) do nothing;
      if found then awarded := awarded + cfg.khatma; end if;
    end loop;
  end if;

  if cfg.adhkar > 0 then
    for rec in
      select period, record_date from public.adhkar_logs
      where student_id = uid and record_date >= today - 1
    loop
      insert into public.points_entries (student_id, category, points, reason, auto_key)
      values (
        uid, 'quran', cfg.adhkar,
        case when rec.period = 'morning' then 'أذكار الصباح' else 'أذكار المساء' end,
        'adhkar_' || rec.period || ':' || uid || ':' || rec.record_date
      )
      on conflict (auto_key) do nothing;
      if found then awarded := awarded + cfg.adhkar; end if;
    end loop;
  end if;

  return awarded;
end;
$$;

revoke execute on function public.set_quran_review(integer) from public, anon;
revoke execute on function public.quran_review_done(integer) from public, anon;
revoke execute on function public.award_quran_points() from public, anon;
grant execute on function public.set_quran_review(integer) to authenticated;
grant execute on function public.quran_review_done(integer) to authenticated;
grant execute on function public.award_quran_points() to authenticated;
