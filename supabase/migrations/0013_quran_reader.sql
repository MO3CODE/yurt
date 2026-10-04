-- ============================================================================
-- قارئ المصحف داخل المنصة: الصفحات المقروءة، تقدّم الختمة، و«وصلت إلى صفحة» للورقي
-- الكتابة على الجدولين الجديدين تتم فقط عبر الدالتين أدناه (لا سياسات كتابة مباشرة)
-- ============================================================================

-- صفحة مقروءة من المنصة: تُحسب مرة واحدة في اليوم لكل صفحة
create table public.quran_page_reads (
  student_id uuid not null references public.students (id) on delete cascade,
  record_date date not null,
  page smallint not null check (page between 1 and 604),
  read_at timestamptz not null default now(),
  primary key (student_id, record_date, page)
);
create index idx_quran_page_reads_student_read_at on public.quran_page_reads (student_id, read_at desc);

-- علامة الختمة: الصفحة التالية في التسلسل، وعدد الختمات المكتملة
create table public.quran_progress (
  student_id uuid primary key references public.students (id) on delete cascade,
  current_page smallint not null default 1 check (current_page between 1 and 604),
  khatmas integer not null default 0 check (khatmas >= 0),
  updated_at timestamptz not null default now()
);

-- «وصلت إلى صفحة…» في نموذج المصحف الورقي (اختياري)
alter table public.quran_wird_logs
  add column reached_page smallint check (reached_page between 1 and 604);

alter table public.quran_page_reads enable row level security;
alter table public.quran_progress enable row level security;

create policy quran_page_reads_select on public.quran_page_reads for select
  using (student_id = (select auth.uid()) or (select public.has_permission('quran')) or public.supervises_student(student_id));

create policy quran_progress_select on public.quran_progress for select
  using (student_id = (select auth.uid()) or (select public.has_permission('quran')) or public.supervises_student(student_id));

-- مجموع صفحات المنصة لكل طالب في كل يوم (للوحة الإدارة بدل جلب كل صفحة على حدة)
create view public.quran_platform_daily with (security_invoker = true) as
select student_id, record_date, count(*)::integer as pages
from public.quran_page_reads
group by student_id, record_date;

grant select on public.quran_platform_daily to authenticated;

-- ----------------------------------------------------------------------------
-- تسجيل صفحة قرأها الطالب في القارئ (بعد ٣٠ ثانية ظاهرة على الشاشة)
-- يتجاهل التسجيل إن جاء بعد أقل من ٢٠ ثانية من آخر صفحة مسجّلة، ويحرّك العلامة
-- فقط إذا كانت الصفحة هي التي عند العلامة بالضبط (القراءة بالتسلسل)
-- ----------------------------------------------------------------------------
create or replace function public.record_quran_page(p_page integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Istanbul')::date;
  last_read timestamptz;
  prog public.quran_progress;
  counted boolean := false;
  completed boolean := false;
begin
  if uid is null or not exists (select 1 from public.students where id = uid) then
    raise exception 'هذه الميزة للطلاب فقط';
  end if;
  if p_page is null or p_page < 1 or p_page > 604 then
    raise exception 'رقم صفحة غير صحيح';
  end if;

  insert into public.quran_progress (student_id) values (uid) on conflict do nothing;
  -- قفل صف الطالب يمنع تسجيلين متزامنين من تجاوز حد الوقت
  select * into prog from public.quran_progress where student_id = uid for update;

  select max(read_at) into last_read from public.quran_page_reads where student_id = uid;
  if last_read is null or now() - last_read >= interval '20 seconds' then
    insert into public.quran_page_reads (student_id, record_date, page)
    values (uid, today, p_page)
    on conflict do nothing;
    counted := found;

    if p_page = prog.current_page then
      completed := p_page = 604;
      update public.quran_progress
      set current_page = case when completed then 1 else p_page + 1 end,
          khatmas = khatmas + case when completed then 1 else 0 end,
          updated_at = now()
      where student_id = uid
      returning * into prog;
    end if;
  end if;

  return jsonb_build_object(
    'counted', counted,
    'khatma_completed', completed,
    'current_page', prog.current_page,
    'khatmas', prog.khatmas,
    'today_pages', (select count(*) from public.quran_page_reads where student_id = uid and record_date = today)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- «وصلت إلى صفحة N» من المصحف الورقي: العلامة ← N+1، و٦٠٤ تُكمل ختمة
-- ----------------------------------------------------------------------------
create or replace function public.set_quran_reached_page(p_page integer)
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
  if p_page is null or p_page < 1 or p_page > 604 then
    raise exception 'رقم صفحة غير صحيح';
  end if;

  insert into public.quran_progress as qp (student_id, current_page, khatmas)
  values (uid, case when p_page = 604 then 1 else p_page + 1 end, case when p_page = 604 then 1 else 0 end)
  on conflict (student_id) do update
  set current_page = excluded.current_page,
      khatmas = qp.khatmas + excluded.khatmas,
      updated_at = now();
end;
$$;

revoke execute on function public.record_quran_page(integer) from public, anon;
revoke execute on function public.set_quran_reached_page(integer) from public, anon;
grant execute on function public.record_quran_page(integer) to authenticated;
grant execute on function public.set_quran_reached_page(integer) to authenticated;
