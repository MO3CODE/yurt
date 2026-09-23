-- ============================================================================
-- دوال مساعدة + سياسات أمان الصفوف (RLS)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- إنشاء ملف شخصي تلقائياً عند تسجيل مستخدم جديد في auth.users
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'student')
  );

  if coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'student') = 'student' then
    insert into public.students (id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- دوال فحص الصلاحيات (security definer لتفادي التكرار اللانهائي في RLS)
-- ----------------------------------------------------------------------------
create or replace function public.current_role()
returns app_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role in ('admin', 'super_admin') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

-- الشقة التي يشرف عليها المستخدم الحالي (إن وجدت)
create or replace function public.supervised_apartment_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.apartments where supervisor_id = auth.uid();
$$;

create or replace function public.is_apartment_supervisor(apt_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.apartments
    where id = apt_id and supervisor_id = auth.uid()
  );
$$;

-- هل الطالب المحدد ضمن الشقة التي يشرف عليها المستخدم الحالي؟
create or replace function public.supervises_student(target_student_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    join public.apartments a on a.id = s.apartment_id
    where s.id = target_student_id and a.supervisor_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- تفعيل RLS على كل الجداول
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.apartments enable row level security;
alter table public.students enable row level security;
alter table public.class_schedule_entries enable row level security;
alter table public.tasks enable row level security;
alter table public.attendance_records enable row level security;
alter table public.prayer_records enable row level security;
alter table public.quran_wird_logs enable row level security;
alter table public.health_records enable row level security;
alter table public.academic_support_requests enable row level security;
alter table public.complaints enable row level security;
alter table public.facilities enable row level security;
alter table public.cleaning_tasks enable row level security;
alter table public.cleaning_assignments enable row level security;
alter table public.facility_issues enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.points_entries enable row level security;
alter table public.alerts enable row level security;
alter table public.generated_reports enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (id = auth.uid() or public.is_admin() or id in (select supervisor_id from public.apartments) );

create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid() or public.is_admin());

create policy "profiles_admin_insert" on public.profiles for insert
  with check (public.is_admin() or id = auth.uid());

-- ----------------------------------------------------------------------------
-- apartments
-- ----------------------------------------------------------------------------
create policy "apartments_select_all_authenticated" on public.apartments for select
  using (auth.uid() is not null);

create policy "apartments_admin_write" on public.apartments for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- students
-- ----------------------------------------------------------------------------
create policy "students_select" on public.students for select
  using (
    id = auth.uid()
    or public.is_admin()
    or public.supervises_student(id)
  );

create policy "students_admin_write" on public.students for all
  using (public.is_admin()) with check (public.is_admin());

create policy "students_self_update" on public.students for update
  using (id = auth.uid());

-- ----------------------------------------------------------------------------
-- class_schedule_entries / tasks (ملكية الطالب فقط + الإدارة)
-- ----------------------------------------------------------------------------
create policy "schedule_owner_or_admin" on public.class_schedule_entries for all
  using (student_id = auth.uid() or public.is_admin() or public.supervises_student(student_id))
  with check (student_id = auth.uid() or public.is_admin());

create policy "tasks_owner_or_admin" on public.tasks for all
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- attendance_records (الطالب يسجل لنفسه، المشرف يعتمد/يعدّل لشقته، الإدارة كل شيء)
-- ----------------------------------------------------------------------------
create policy "attendance_select" on public.attendance_records for select
  using (student_id = auth.uid() or public.is_admin() or public.supervises_student(student_id));

create policy "attendance_insert" on public.attendance_records for insert
  with check (student_id = auth.uid() or public.is_admin() or public.supervises_student(student_id));

create policy "attendance_update" on public.attendance_records for update
  using (student_id = auth.uid() or public.is_admin() or public.supervises_student(student_id));

-- ----------------------------------------------------------------------------
-- prayer_records / quran_wird_logs (ملكية الطالب، رؤية للمشرف والإدارة)
-- ----------------------------------------------------------------------------
create policy "prayer_select" on public.prayer_records for select
  using (student_id = auth.uid() or public.is_admin() or public.supervises_student(student_id));
create policy "prayer_write_own" on public.prayer_records for all
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

create policy "wird_select" on public.quran_wird_logs for select
  using (student_id = auth.uid() or public.is_admin() or public.supervises_student(student_id));
create policy "wird_write_own" on public.quran_wird_logs for all
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- health_records (الطالب يبلّغ عن نفسه، المشرف يبلّغ عن شقته، الإدارة كل شيء)
-- ----------------------------------------------------------------------------
create policy "health_select" on public.health_records for select
  using (student_id = auth.uid() or public.is_admin() or public.supervises_student(student_id));
create policy "health_write" on public.health_records for all
  using (student_id = auth.uid() or public.is_admin() or public.supervises_student(student_id))
  with check (student_id = auth.uid() or public.is_admin() or public.supervises_student(student_id));

-- ----------------------------------------------------------------------------
-- academic_support_requests
-- ----------------------------------------------------------------------------
create policy "academic_support_select" on public.academic_support_requests for select
  using (student_id = auth.uid() or public.is_admin());
create policy "academic_support_insert" on public.academic_support_requests for insert
  with check (student_id = auth.uid() or public.is_admin());
create policy "academic_support_update" on public.academic_support_requests for update
  using (public.is_admin() or student_id = auth.uid());

-- ----------------------------------------------------------------------------
-- complaints (الطالب يقدّم ويرى شكاواه، المشرف يرى/يفرز شكاوى شقته، الإدارة كل شيء)
-- ----------------------------------------------------------------------------
create policy "complaints_select" on public.complaints for select
  using (
    student_id = auth.uid()
    or public.is_admin()
    or public.is_apartment_supervisor(apartment_id)
  );
create policy "complaints_insert" on public.complaints for insert
  with check (student_id = auth.uid() or public.is_admin());
create policy "complaints_update" on public.complaints for update
  using (public.is_admin() or public.is_apartment_supervisor(apartment_id) or student_id = auth.uid());

-- ----------------------------------------------------------------------------
-- facilities / facility_issues
-- ----------------------------------------------------------------------------
create policy "facilities_select_all" on public.facilities for select
  using (auth.uid() is not null);
create policy "facilities_admin_write" on public.facilities for all
  using (public.is_admin()) with check (public.is_admin());

create policy "facility_issues_select_all" on public.facility_issues for select
  using (auth.uid() is not null);
create policy "facility_issues_insert_all" on public.facility_issues for insert
  with check (auth.uid() is not null);
create policy "facility_issues_admin_update" on public.facility_issues for update
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- cleaning_tasks / cleaning_assignments
-- ----------------------------------------------------------------------------
create policy "cleaning_tasks_select_all" on public.cleaning_tasks for select
  using (auth.uid() is not null);
create policy "cleaning_tasks_admin_or_supervisor_write" on public.cleaning_tasks for all
  using (public.is_admin() or public.is_apartment_supervisor(apartment_id))
  with check (public.is_admin() or public.is_apartment_supervisor(apartment_id));

create policy "cleaning_assignments_select_all" on public.cleaning_assignments for select
  using (auth.uid() is not null);
create policy "cleaning_assignments_write" on public.cleaning_assignments for all
  using (
    public.is_admin()
    or student_id = auth.uid()
    or exists (
      select 1 from public.cleaning_tasks t
      where t.id = task_id and public.is_apartment_supervisor(t.apartment_id)
    )
  );

-- ----------------------------------------------------------------------------
-- notifications (القراءة حسب الاستهداف، الكتابة للإدارة والمشرف)
-- ----------------------------------------------------------------------------
create policy "notifications_select" on public.notifications for select
  using (
    target_type = 'all'
    or (target_type = 'role' and target_role = public.current_role())
    or (target_type = 'student' and target_student_id = auth.uid())
    or (target_type = 'apartment' and target_apartment_id in (
          select apartment_id from public.students where id = auth.uid()
        ))
    or public.is_admin()
  );

create policy "notifications_write" on public.notifications for insert
  with check (
    public.is_admin()
    or (target_type = 'apartment' and public.is_apartment_supervisor(target_apartment_id))
  );

create policy "notification_reads_own" on public.notification_reads for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "push_subscriptions_own" on public.push_subscriptions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- points_entries (يراها الطالب لنفسه، تُكتب من الإدارة/المشرف فقط)
-- ----------------------------------------------------------------------------
create policy "points_select" on public.points_entries for select
  using (student_id = auth.uid() or public.is_admin() or public.supervises_student(student_id));
create policy "points_write" on public.points_entries for insert
  with check (public.is_admin() or public.supervises_student(student_id));

-- ----------------------------------------------------------------------------
-- alerts (الإدارة والمشرف المعني فقط)
-- ----------------------------------------------------------------------------
create policy "alerts_select" on public.alerts for select
  using (public.is_admin() or public.is_apartment_supervisor(apartment_id) or student_id = auth.uid());
create policy "alerts_admin_write" on public.alerts for all
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- generated_reports (الإدارة فقط)
-- ----------------------------------------------------------------------------
create policy "reports_admin_only" on public.generated_reports for all
  using (public.is_admin()) with check (public.is_admin());
