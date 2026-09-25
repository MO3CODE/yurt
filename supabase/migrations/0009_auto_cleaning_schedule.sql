-- =====================================================================
-- 0009 — جدول النظافة التلقائي
-- تدوير أسبوعي عادل: مهام كل شقة تدور على طلابها النشطين، وتتقدّم خانة
-- كل أسبوع فيمرّ كل طالب على كل مهمة بالتناوب. مهام المرافق العامة تدور
-- على كل طلاب السكن. التوليد يملأ المهام غير المعيّنة فقط (لا يلمس ما
-- عدّله المشرف يدوياً)، ويعمل تلقائياً كل ليلة عبر pg_cron.
-- =====================================================================

create extension if not exists pg_cron;

-- بداية الأسبوع (الأحد) بتوقيت إسطنبول — نفس منطق weekStartISO في الواجهة
create or replace function public.cleaning_week_start(d date default null)
returns date
language sql
stable
set search_path = public
as $$
  select x - extract(dow from x)::int
  from (select coalesce(d, (now() at time zone 'Europe/Istanbul')::date) as x) s;
$$;

create or replace function public.generate_cleaning_schedule(
  p_week date default null,
  p_apartment uuid default null,
  p_rebalance boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  wk date := public.cleaning_week_start(p_week);
  -- رقم الأسبوع منذ أحدٍ مرجعي؛ يحدد موضع الدوران
  wnum integer := (public.cleaning_week_start(p_week) - date '2024-01-07') / 7;
  apt record;
  stu uuid[];
  tsk uuid[];
  n integer;
  m integer;
  i integer;
  c integer;
  inserted integer := 0;
begin
  -- الجدولة الليلية تعمل بلا مستخدم؛ من الواجهة: صلاحية «النظافة» أو مشرف الشقة نفسها
  if auth.uid() is not null
     and not public.has_permission('cleaning')
     and not (p_apartment is not null and public.is_apartment_supervisor(p_apartment)) then
    raise exception 'ليست لديك صلاحية توزيع النظافة';
  end if;

  -- مهام الشقق
  for apt in select a.id from public.apartments a where p_apartment is null or a.id = p_apartment loop
    if p_rebalance then
      delete from public.cleaning_assignments ca
      using public.cleaning_tasks t
      where ca.task_id = t.id and t.apartment_id = apt.id and ca.week_start_date = wk and ca.status = 'pending';
    end if;

    select array_agg(s.id order by s.created_at, s.id) into stu
    from public.students s where s.apartment_id = apt.id and s.status = 'active';
    select array_agg(t.id order by t.created_at, t.id) into tsk
    from public.cleaning_tasks t where t.scope = 'apartment' and t.apartment_id = apt.id;

    n := coalesce(array_length(stu, 1), 0);
    m := coalesce(array_length(tsk, 1), 0);
    continue when n = 0 or m = 0;

    for i in 1 .. m loop
      insert into public.cleaning_assignments (task_id, student_id, week_start_date, status)
      values (tsk[i], stu[(((i - 1 + wnum) % n) + n) % n + 1], wk, 'pending')
      on conflict (task_id, week_start_date) do nothing;
      get diagnostics c = row_count;
      inserted := inserted + c;
    end loop;
  end loop;

  -- مهام المرافق العامة: تدور على كل الطلاب النشطين (في التوزيع العام فقط)
  if p_apartment is null then
    if p_rebalance then
      delete from public.cleaning_assignments ca
      using public.cleaning_tasks t
      where ca.task_id = t.id and t.scope = 'facility' and ca.week_start_date = wk and ca.status = 'pending';
    end if;

    select array_agg(s.id order by s.created_at, s.id) into stu
    from public.students s where s.status = 'active' and s.apartment_id is not null;
    select array_agg(t.id order by t.created_at, t.id) into tsk
    from public.cleaning_tasks t where t.scope = 'facility';

    n := coalesce(array_length(stu, 1), 0);
    m := coalesce(array_length(tsk, 1), 0);
    if n > 0 and m > 0 then
      for i in 1 .. m loop
        -- الإزاحة بعدد المهام كل أسبوع حتى يمرّ الدور على الجميع
        insert into public.cleaning_assignments (task_id, student_id, week_start_date, status)
        values (tsk[i], stu[(((i - 1 + wnum * m) % n) + n) % n + 1], wk, 'pending')
        on conflict (task_id, week_start_date) do nothing;
        get diagnostics c = row_count;
        inserted := inserted + c;
      end loop;
    end if;
  end if;

  return inserted;
end;
$$;

revoke execute on function public.generate_cleaning_schedule(date, uuid, boolean) from public, anon;
grant execute on function public.generate_cleaning_schedule(date, uuid, boolean) to authenticated, service_role;
grant execute on function public.cleaning_week_start(date) to authenticated, service_role;

-- كل ليلة 00:05 بتوقيت إسطنبول (21:05 UTC): يملأ أسبوع اليوم إن نقصه شيء
select cron.unschedule(jobid) from cron.job where jobname = 'generate-cleaning-schedule';
select cron.schedule(
  'generate-cleaning-schedule',
  '5 21 * * *',
  $cron$select public.generate_cleaning_schedule()$cron$
);

-- توزيع الأسبوع الحالي فوراً
select public.generate_cleaning_schedule();
