-- =====================================================================
-- 0019 — متابعة طلاب المنحة: المواد والدرجات، حالة المنحة، مسابقة التميز، المدرّسون
--   • سلالم الدرجات (YÖK والأمريكي) وسلّم كل طالب
--   • مواد كل كشف (الساعات والحرف أو النسبة) يكتبها الطالب مع الكشف
--   • «أُعيد للطالب»: الإدارة تعيد الكشف بملاحظة فيعدّله ويرسله ثانية
--   • حالة الطالب في كل ترم (متميز / آمن / مراقبة / إنذار / خطر) تُحسب عند التأكيد
--   • جوائز التميز (مستحقة ← معتمدة ← مصروفة)، والمصروفة لا تتغير
--   • طلبات الدعم: أولوية ومصدر (تلقائي / الطالب / الإدارة) ومدرّس وجلسات وأثر
--   • الإعدادات: كل الحدود والمبالغ في صف واحد قابل للتعديل
-- الصلاحية: academic (والطالب يرى ما يخصه فقط)
-- =====================================================================

-- ---------------------------------------------------------------------
-- سلالم الدرجات
-- items: [{ "letter": "AA", "points": 4 }, { "letter": "W", "points": null }]
-- points = null ← رمز لا يدخل في المعدل (انسحاب، ناجح بلا درجة…)
-- ---------------------------------------------------------------------
create table public.academic_grade_scales (
  key text primary key check (key ~ '^[a-z0-9_]{2,20}$'),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  sort_order integer not null default 0
);

insert into public.academic_grade_scales (key, name, items, sort_order) values
(
  'yok', 'التركي (YÖK)',
  '[{"letter":"AA","points":4},{"letter":"BA","points":3.5},{"letter":"BB","points":3},{"letter":"CB","points":2.5},
    {"letter":"CC","points":2},{"letter":"DC","points":1.5},{"letter":"DD","points":1},{"letter":"FD","points":0.5},
    {"letter":"FF","points":0},{"letter":"NA","points":0},{"letter":"DZ","points":0},
    {"letter":"YT","points":null},{"letter":"YZ","points":null},{"letter":"G","points":null},{"letter":"K","points":null},
    {"letter":"W","points":null},{"letter":"EX","points":null}]'::jsonb,
  1
),
(
  'us', 'الأمريكي (4.0)',
  '[{"letter":"A","points":4},{"letter":"A-","points":3.7},{"letter":"B+","points":3.3},{"letter":"B","points":3},
    {"letter":"B-","points":2.7},{"letter":"C+","points":2.3},{"letter":"C","points":2},{"letter":"C-","points":1.7},
    {"letter":"D+","points":1.3},{"letter":"D","points":1},{"letter":"F","points":0},
    {"letter":"W","points":null},{"letter":"I","points":null},{"letter":"P","points":null},{"letter":"EX","points":null}]'::jsonb,
  2
);

-- سلّم الطالب (التركي افتراضياً)
alter table public.student_academic_profiles
  add column grade_scale text not null default 'yok' references public.academic_grade_scales (key) on update cascade;

-- ---------------------------------------------------------------------
-- الإعدادات (صف واحد؛ القيم الناقصة تأخذ الافتراضي من الكود)
-- ---------------------------------------------------------------------
create table public.academic_settings (
  id boolean primary key default true check (id),
  value jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.academic_settings (id) values (true);

-- ---------------------------------------------------------------------
-- الكشوف: حالة «أُعيد للطالب»
-- ---------------------------------------------------------------------
alter table public.grade_reports drop constraint grade_reports_status_check;
alter table public.grade_reports add constraint grade_reports_status_check check (status in ('pending', 'returned', 'reviewed'));

drop policy grade_reports_update_own_pending on public.grade_reports;
create policy grade_reports_update_own_pending on public.grade_reports for update
  using (student_id = (select auth.uid()) and status in ('pending', 'returned'))
  with check (student_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and verified_cumulative_gpa is null);

-- ---------------------------------------------------------------------
-- مواد الكشف
-- ---------------------------------------------------------------------
create table public.grade_report_courses (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.grade_reports (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  sort_order integer not null default 0,
  course_code text check (char_length(course_code) <= 20),
  course_name text not null check (char_length(btrim(course_name)) between 2 and 120),
  credits numeric(4, 1) not null check (credits > 0 and credits <= 30),
  letter text check (char_length(letter) <= 4),                 -- النهائي
  percent numeric(5, 2) check (percent between 0 and 100),     -- النصفي
  is_repeat boolean not null default false,
  help_requested boolean not null default false,
  -- يحسبها النظام عند التأكيد
  points numeric(3, 2) check (points between 0 and 4),
  risk_level text check (risk_level in ('fail', 'struggling', 'weak', 'early_risk', 'ok', 'excluded'))
);
create index idx_report_courses_report on public.grade_report_courses (report_id, sort_order);
create index idx_report_courses_student on public.grade_report_courses (student_id);

alter table public.grade_report_courses enable row level security;

create policy report_courses_select on public.grade_report_courses for select
  using (student_id = (select auth.uid()) or (select public.has_permission('academic')));
create policy report_courses_staff on public.grade_report_courses for all
  using ((select public.has_permission('academic')))
  with check ((select public.has_permission('academic')));
-- الطالب يكتب مواد كشفه ما دام لم يُؤكَّد، ولا يكتب ما يحسبه النظام
create policy report_courses_own_write on public.grade_report_courses for all
  using (
    student_id = (select auth.uid())
    and exists (select 1 from public.grade_reports r where r.id = report_id and r.student_id = (select auth.uid()) and r.status in ('pending', 'returned'))
  )
  with check (
    student_id = (select auth.uid())
    and points is null and risk_level is null
    and exists (select 1 from public.grade_reports r where r.id = report_id and r.student_id = (select auth.uid()) and r.status in ('pending', 'returned'))
  );

-- ---------------------------------------------------------------------
-- حالة الطالب في كل ترم
-- ---------------------------------------------------------------------
create table public.academic_standings (
  student_id uuid not null references public.students (id) on delete cascade,
  term_id uuid not null references public.academic_terms (id) on delete cascade,
  report_id uuid references public.grade_reports (id) on delete set null,
  term_gpa numeric(3, 2) check (term_gpa between 0 and 4),
  cum_gpa numeric(3, 2) check (cum_gpa between 0 and 4),
  calc_term_gpa numeric(3, 2) check (calc_term_gpa between 0 and 4),
  term_credits numeric(5, 1) not null default 0,
  has_fail boolean not null default false,
  gpa_source text not null check (gpa_source in ('official', 'calculated')),
  status text not null check (status in ('excellent', 'safe', 'watch', 'warning', 'at_risk')),
  flags text[] not null default '{}',
  computed_at timestamptz not null default now(),
  primary key (student_id, term_id)
);
create index idx_standings_term on public.academic_standings (term_id, status);

alter table public.academic_standings enable row level security;
create policy standings_select on public.academic_standings for select
  using (student_id = (select auth.uid()) or (select public.has_permission('academic')));
create policy standings_staff on public.academic_standings for all
  using ((select public.has_permission('academic')))
  with check ((select public.has_permission('academic')));

-- ---------------------------------------------------------------------
-- جوائز التميز
-- ---------------------------------------------------------------------
create table public.academic_awards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  term_id uuid not null references public.academic_terms (id) on delete cascade,
  gpa_used numeric(3, 2) not null check (gpa_used between 0 and 4),
  tier text not null check (tier in ('gold', 'silver', 'bronze')),
  amount numeric(8, 2) not null check (amount >= 0),
  currency text not null default 'USD' check (char_length(currency) between 3 and 5),
  status text not null default 'eligible' check (status in ('eligible', 'approved', 'paid', 'cancelled')),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  paid_at date,
  payment_method text check (char_length(payment_method) <= 60),
  payment_ref text check (char_length(payment_ref) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, term_id)
);
create index idx_awards_term on public.academic_awards (term_id, status);

alter table public.academic_awards enable row level security;
create policy awards_select on public.academic_awards for select
  using (student_id = (select auth.uid()) or (select public.has_permission('academic')));
create policy awards_staff on public.academic_awards for all
  using ((select public.has_permission('academic')))
  with check ((select public.has_permission('academic')));

-- الجائزة المصروفة لا تُحذف ولا يتغير مبلغها أو فئتها أو حالتها
create or replace function public.guard_paid_award()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'paid' then
    if tg_op = 'DELETE' then
      raise exception 'لا يمكن حذف جائزة مصروفة';
    end if;
    if (new.status, new.amount, new.tier, new.gpa_used, new.student_id, new.term_id)
       is distinct from (old.status, old.amount, old.tier, old.gpa_used, old.student_id, old.term_id) then
      raise exception 'لا يمكن تعديل جائزة مصروفة';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_paid_award before update or delete on public.academic_awards
  for each row execute function public.guard_paid_award();
create trigger touch_updated_at before update on public.academic_awards
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- المدرّسون الخصوصيون وجلساتهم
-- ---------------------------------------------------------------------
create table public.academic_tutors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 80),
  phone text check (char_length(phone) <= 30),
  subjects text[] not null default '{}',
  hourly_rate numeric(8, 2) check (hourly_rate >= 0),
  currency text not null default 'TRY' check (char_length(currency) between 3 and 5),
  rating numeric(2, 1) check (rating between 0 and 5),
  notes text check (char_length(notes) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.academic_support_requests
  add column term_id uuid references public.academic_terms (id) on delete set null,
  add column course_id uuid references public.grade_report_courses (id) on delete set null,
  add column priority text check (priority in ('urgent', 'high', 'medium')),
  add column source text not null default 'student' check (source in ('auto', 'student', 'staff')),
  add column tutor_id uuid references public.academic_tutors (id) on delete set null,
  add column baseline_points numeric(3, 2) check (baseline_points between 0 and 4),
  add column baseline_percent numeric(5, 2) check (baseline_percent between 0 and 100),
  add column outcome_points numeric(3, 2) check (outcome_points between 0 and 4);
create index idx_support_requests_term on public.academic_support_requests (term_id);
create index idx_support_requests_tutor on public.academic_support_requests (tutor_id);
create index idx_support_requests_course on public.academic_support_requests (course_id);

-- الطالب يطلب الدعم بنفسه فقط (لا يحدد أولوية ولا مدرّساً ولا يدّعي أنه طلب تلقائي)
drop policy if exists academic_support_insert on public.academic_support_requests;
create policy academic_support_insert on public.academic_support_requests for insert
  with check (
    (select public.has_permission('academic'))
    or (
      student_id = (select auth.uid())
      and status = 'open'
      and source = 'student'
      and assigned_to_profile_id is null
      and assigned_to_name is null
      and admin_notes is null
      and priority is null
      and tutor_id is null
      and outcome_points is null
    )
  );

create table public.academic_tutoring_sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.academic_support_requests (id) on delete cascade,
  tutor_id uuid references public.academic_tutors (id) on delete set null,
  session_date date not null,
  duration_hours numeric(4, 2) not null check (duration_hours > 0 and duration_hours <= 12),
  attended boolean not null default true,
  cost numeric(8, 2) check (cost >= 0),
  note text check (char_length(note) <= 1000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_tutoring_sessions_request on public.academic_tutoring_sessions (request_id, session_date desc);
create index idx_tutoring_sessions_tutor on public.academic_tutoring_sessions (tutor_id);

-- ---------------------------------------------------------------------
-- RLS للجداول الإدارية فقط
-- ---------------------------------------------------------------------
alter table public.academic_grade_scales enable row level security;
create policy grade_scales_read on public.academic_grade_scales for select
  using ((select auth.uid()) is not null);
create policy grade_scales_write on public.academic_grade_scales for all
  using ((select public.has_permission('academic')))
  with check ((select public.has_permission('academic')));

do $$
declare t text;
begin
  foreach t in array array['academic_settings', 'academic_tutors', 'academic_tutoring_sessions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using ((select public.has_permission(''academic''))) with check ((select public.has_permission(''academic'')))',
      t || '_staff', t
    );
  end loop;
end;
$$;

-- سجل النشاط
do $$
declare t text;
begin
  foreach t in array array['academic_settings', 'academic_awards', 'academic_tutors', 'academic_tutoring_sessions']
  loop
    execute format('create trigger audit_log_trigger after insert or update or delete on public.%I for each row execute function public.write_audit_log()', t);
  end loop;
end;
$$;
