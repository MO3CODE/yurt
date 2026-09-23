-- ============================================================================
-- منصة متابعة السكن الطلابي — المخطط الأساسي لقاعدة البيانات
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type app_role as enum ('super_admin', 'admin', 'student');
create type student_status as enum ('active', 'on_leave', 'graduated', 'withdrawn');
create type attendance_status as enum ('present', 'absent', 'excused', 'late');
create type record_source as enum ('self', 'supervisor', 'admin');
create type prayer_name as enum ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha');
create type prayer_status as enum ('mosque', 'prayed', 'missed');
create type health_severity as enum ('mild', 'moderate', 'severe');
create type health_status as enum ('ongoing', 'recovered');
create type support_status as enum ('open', 'assigned', 'in_progress', 'resolved', 'closed');
create type complaint_category as enum ('complaint', 'suggestion');
create type complaint_status as enum ('new', 'triaged', 'in_progress', 'escalated', 'resolved', 'rejected');
create type cleaning_scope as enum ('apartment', 'facility');
create type cleaning_status as enum ('pending', 'done', 'missed');
create type facility_issue_status as enum ('open', 'in_progress', 'resolved');
create type priority_level as enum ('low', 'medium', 'high', 'urgent');
create type notification_target as enum ('all', 'apartment', 'student', 'role');
create type task_status as enum ('pending', 'done');
create type points_category as enum ('prayer', 'quran', 'attendance', 'cleaning', 'academic', 'other');
create type alert_severity as enum ('info', 'warning', 'critical');

-- ----------------------------------------------------------------------------
-- الملفات الشخصية (تمتد من auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  role app_role not null default 'student',
  -- صلاحيات إدارية دقيقة (تُستخدم فقط عندما role IN ('admin','super_admin'))
  manage_academic boolean not null default false,
  manage_religious boolean not null default false,
  manage_facilities boolean not null default false,
  manage_reports boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'كل مستخدمي المنصة: الإدارة والطلاب';

-- ----------------------------------------------------------------------------
-- الشقق
-- ----------------------------------------------------------------------------
create table public.apartments (
  id uuid primary key default gen_random_uuid(),
  floor_number int not null,
  name text not null,
  supervisor_id uuid references public.profiles (id) on delete set null,
  capacity int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.apartments is 'شقق السكن — كل طابق شقة، ولها مشرف من الطلاب';

-- ----------------------------------------------------------------------------
-- بيانات الطالب الأكاديمية/الإدارية
-- ----------------------------------------------------------------------------
create table public.students (
  id uuid primary key references public.profiles (id) on delete cascade,
  apartment_id uuid references public.apartments (id) on delete set null,
  university_name text,
  major text,
  academic_year text,
  scholarship_reference text,
  status student_status not null default 'active',
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.students is 'بيانات تكميلية للطالب: الشقة، الجامعة، حالة القيد';

-- الجدول الجامعي الأسبوعي (يُدخله الطالب بنفسه)
create table public.class_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=الأحد
  start_time time not null,
  end_time time not null,
  course_name text not null,
  location text,
  created_at timestamptz not null default now()
);

-- المهام الشخصية (to-do list)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status task_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- الحضور والغياب الجامعي
-- ----------------------------------------------------------------------------
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  record_date date not null,
  status attendance_status not null,
  source record_source not null default 'self',
  note text,
  recorded_by uuid references public.profiles (id),
  approved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (student_id, record_date)
);

-- ----------------------------------------------------------------------------
-- الصلوات الخمس
-- ----------------------------------------------------------------------------
create table public.prayer_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  record_date date not null,
  prayer prayer_name not null,
  status prayer_status not null,
  created_at timestamptz not null default now(),
  unique (student_id, record_date, prayer)
);

-- ----------------------------------------------------------------------------
-- الورد القرآني
-- ----------------------------------------------------------------------------
create table public.quran_wird_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  record_date date not null,
  range_description text, -- مثال: "الكهف 1-20"
  pages numeric(4,1),
  memorization boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, record_date)
);

-- ----------------------------------------------------------------------------
-- السجل الصحي
-- ----------------------------------------------------------------------------
create table public.health_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  reported_by uuid references public.profiles (id),
  start_date date not null default current_date,
  end_date date,
  condition_description text not null,
  severity health_severity not null default 'mild',
  status health_status not null default 'ongoing',
  needs_followup boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- الدعم الأكاديمي (طلبات تقوية)
-- ----------------------------------------------------------------------------
create table public.academic_support_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject text not null,
  description text,
  status support_status not null default 'open',
  assigned_to_name text,
  assigned_to_profile_id uuid references public.profiles (id),
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ----------------------------------------------------------------------------
-- الشكاوى والمقترحات
-- ----------------------------------------------------------------------------
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students (id) on delete set null,
  apartment_id uuid references public.apartments (id) on delete set null,
  category complaint_category not null default 'complaint',
  subject text not null,
  description text not null,
  status complaint_status not null default 'new',
  attachment_url text,
  supervisor_response text,
  admin_response text,
  escalated_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- جدول النظافة (للشقق وللمرافق العامة)
-- ----------------------------------------------------------------------------
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- المصلى، الديوانية، الحوش، المصعد، الدرج...
  facility_type text,
  floor_number int,
  notes text,
  created_at timestamptz not null default now()
);

create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  scope cleaning_scope not null,
  apartment_id uuid references public.apartments (id) on delete cascade,
  facility_id uuid references public.facilities (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  check (
    (scope = 'apartment' and apartment_id is not null and facility_id is null) or
    (scope = 'facility' and facility_id is not null and apartment_id is null)
  )
);

create table public.cleaning_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.cleaning_tasks (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  week_start_date date not null,
  status cleaning_status not null default 'pending',
  photo_url text,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, week_start_date)
);

-- بلاغات أعطال/مشاكل المرافق
create table public.facility_issues (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  reported_by uuid references public.profiles (id),
  description text not null,
  status facility_issue_status not null default 'open',
  priority priority_level not null default 'medium',
  photo_url text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- الإشعارات
-- ----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_type notification_target not null,
  target_apartment_id uuid references public.apartments (id) on delete cascade,
  target_student_id uuid references public.students (id) on delete cascade,
  target_role app_role,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, profile_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- النقاط والتحفيز
-- ----------------------------------------------------------------------------
create table public.points_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  category points_category not null,
  points int not null,
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- تنبيهات "حالة تستدعي انتباه"
-- ----------------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students (id) on delete cascade,
  apartment_id uuid references public.apartments (id) on delete cascade,
  severity alert_severity not null default 'warning',
  category text not null, -- 'attendance' | 'prayer' | 'health' | 'cleaning' | 'complaints'
  message text not null,
  resolved boolean not null default false,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- سجل التقارير الرسمية المُصدّرة
-- ----------------------------------------------------------------------------
create table public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null, -- 'student' | 'apartment' | 'dorm'
  scope_id uuid,
  period_start date not null,
  period_end date not null,
  file_url text,
  generated_by uuid references public.profiles (id),
  generated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- فهارس
-- ----------------------------------------------------------------------------
create index idx_students_apartment on public.students (apartment_id);
create index idx_attendance_student_date on public.attendance_records (student_id, record_date desc);
create index idx_prayer_student_date on public.prayer_records (student_id, record_date desc);
create index idx_wird_student_date on public.quran_wird_logs (student_id, record_date desc);
create index idx_complaints_apartment on public.complaints (apartment_id);
create index idx_complaints_status on public.complaints (status);
create index idx_cleaning_assignments_week on public.cleaning_assignments (week_start_date);
create index idx_alerts_unresolved on public.alerts (resolved) where resolved = false;
create index idx_notifications_apartment on public.notifications (target_apartment_id);
create index idx_points_student on public.points_entries (student_id);
