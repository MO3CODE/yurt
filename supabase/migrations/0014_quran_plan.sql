-- ============================================================================
-- خطة الورد: الطالب يحدد من أين يبدأ ختمته وكم صفحة ورده اليومي
-- ============================================================================

alter table public.quran_progress
  add column daily_goal smallint check (daily_goal between 1 and 604);

-- p_start: الصفحة التي يبدأ منها (تنقل العلامة إليها؛ null = تبقى كما هي)
-- p_daily_goal: عدد صفحات الورد اليومي (null = بلا هدف)
create or replace function public.set_quran_plan(p_start integer, p_daily_goal integer)
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
  if p_start is not null and (p_start < 1 or p_start > 604) then
    raise exception 'صفحة البدء بين ١ و٦٠٤';
  end if;
  if p_daily_goal is not null and (p_daily_goal < 1 or p_daily_goal > 604) then
    raise exception 'الورد اليومي بين صفحة و٦٠٤ صفحات';
  end if;

  insert into public.quran_progress as qp (student_id, current_page, daily_goal)
  values (uid, coalesce(p_start, 1), p_daily_goal)
  on conflict (student_id) do update
  set current_page = coalesce(p_start, qp.current_page),
      daily_goal = p_daily_goal,
      updated_at = now();
end;
$$;

revoke execute on function public.set_quran_plan(integer, integer) from public, anon;
grant execute on function public.set_quran_plan(integer, integer) to authenticated;
