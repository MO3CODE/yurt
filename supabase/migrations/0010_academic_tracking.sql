-- =====================================================================
-- 0010 — المتابعة الأكاديمية
--   • ملف أكاديمي لكل طالب (المعدل + المواد القوية والمتعثرة)
--   • جلسات التقييم الفردية (تاريخ كل جلسة وملخصها وموعد التالية)
--   • خطوات المعالجة لكل مادة (إحضار أستاذ تقوية…) لتقرير المواد المشتركة
--   • سجل تذكيرات واتساب المرسلة
--   • خطة المتابعة (أكاديمي / مهاراتي / تطويري) وحالة كل بند
-- كل هذه البيانات حساسة: القراءة والكتابة لمن يملك صلاحية «academic» فقط
-- (والمدير العام). الطلاب والمشرفون لا يصلون إليها.
-- =====================================================================

create type public.subject_standing as enum ('strong', 'struggling');
create type public.remediation_status as enum ('planned', 'in_progress', 'done');
create type public.plan_track as enum ('academic', 'skills', 'development', 'other');
create type public.plan_status as enum ('todo', 'in_progress', 'done', 'blocked');

-- كتالوج المواد (اسم واحد لكل مادة حتى يُجمَّع الطلاب المتعثرون فيها)
create table public.academic_subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

-- الملف الأكاديمي الحالي للطالب
create table public.student_academic_profiles (
  student_id uuid primary key references public.students (id) on delete cascade,
  gpa numeric(5, 2) check (gpa is null or gpa >= 0),
  gpa_scale numeric(5, 2) not null default 4 check (gpa_scale > 0),
  last_session_at date,
  next_session_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gpa is null or gpa <= gpa_scale)
);

-- مواد الطالب: قوي فيها أو متعثر (مع درجته اختيارياً)
create table public.student_subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject_id uuid not null references public.academic_subjects (id) on delete cascade,
  standing public.subject_standing not null,
  grade numeric(5, 2) check (grade is null or (grade >= 0 and grade <= 100)),
  note text,
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id)
);

-- جلسات التقييم الفردية
create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  session_date date not null,
  conducted_by uuid references public.profiles (id) on delete set null,
  gpa numeric(5, 2) check (gpa is null or gpa >= 0),
  gpa_scale numeric(5, 2) not null default 4 check (gpa_scale > 0),
  summary text,
  action_items text,
  next_session_date date,
  created_at timestamptz not null default now()
);

-- خطوات معالجة التعثر في مادة (على مستوى المادة لا الطالب)
create table public.subject_actions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.academic_subjects (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  status public.remediation_status not null default 'planned',
  tutor_name text,
  due_date date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- خطة المتابعة
create table public.follow_up_plan_items (
  id uuid primary key default gen_random_uuid(),
  track public.plan_track not null default 'academic',
  phase text,
  title text not null check (length(btrim(title)) > 0),
  notes text,
  status public.plan_status not null default 'todo',
  due_date date,
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- سجل تذكيرات واتساب (تُسجَّل عند فتح الرسالة للإرسال)
create table public.academic_reminders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  kind text not null check (kind in ('session', 'grades', 'tutoring', 'custom')),
  subject_id uuid references public.academic_subjects (id) on delete set null,
  message text not null,
  sent_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_student_subjects_subject on public.student_subjects (subject_id);
create index idx_sessions_student_date on public.assessment_sessions (student_id, session_date desc);
create index idx_subject_actions_subject on public.subject_actions (subject_id);
create index idx_academic_reminders_student on public.academic_reminders (student_id, created_at desc);
create index idx_plan_items_order on public.follow_up_plan_items (track, sort_order);
create index idx_academic_profiles_next_session on public.student_academic_profiles (next_session_at);
create index idx_assessment_sessions_by on public.assessment_sessions (conducted_by);
create index idx_subject_actions_by on public.subject_actions (created_by);
create index idx_plan_items_by on public.follow_up_plan_items (created_by);
create index idx_academic_reminders_by on public.academic_reminders (sent_by);
create index idx_academic_reminders_subject on public.academic_reminders (subject_id);

-- ---------------------------------------------------------------------
-- RLS: صلاحية «academic» فقط
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'academic_subjects', 'student_academic_profiles', 'student_subjects', 'assessment_sessions',
    'subject_actions', 'follow_up_plan_items', 'academic_reminders'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using ((select public.has_permission(''academic''))) with check ((select public.has_permission(''academic'')))',
      t || '_staff', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers: updated_at / completed_at / سجل النشاط
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.stamp_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status::text = 'done' then
    if tg_op = 'INSERT' or old.status::text is distinct from 'done' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger touch_updated_at before update on public.student_academic_profiles
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.student_subjects
  for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.follow_up_plan_items
  for each row execute function public.touch_updated_at();

create trigger stamp_completed_at before insert or update on public.subject_actions
  for each row execute function public.stamp_completed_at();
create trigger stamp_completed_at before insert or update on public.follow_up_plan_items
  for each row execute function public.stamp_completed_at();

do $$
declare t text;
begin
  foreach t in array array[
    'student_academic_profiles', 'student_subjects', 'assessment_sessions', 'subject_actions', 'follow_up_plan_items'
  ]
  loop
    execute format('create trigger audit_log_trigger after insert or update or delete on public.%I for each row execute function public.write_audit_log()', t);
  end loop;
end;
$$;
