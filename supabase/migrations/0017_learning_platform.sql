-- ============================================================================
-- المنصة التعليمية: كورسات (فيديو يوتيوب، قراءة، كلمات، تدريبات كتابة)،
-- الانضمام بموعد إنهاء، تقدّم الطالب، تسليمات الكتابة ومراجعتها، والنقاط
-- الصلاحية: learning (المدير العام يملكها ضمنياً)
-- ============================================================================

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('academic', 'languages', 'personal', 'professional')),
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 4000),
  level text check (level in ('beginner', 'intermediate', 'advanced')),
  cover_url text,
  youtube_playlist_id text,
  published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('video', 'reading', 'vocab', 'writing')),
  title text not null check (char_length(title) between 1 and 200),
  youtube_video_id text,
  duration_seconds integer check (duration_seconds >= 0),
  -- نص القراءة أو تعليمات الكتابة
  body text check (char_length(body) <= 20000),
  -- الكلمات: [{word, meaning, example}]، الكتابة: {"topics": ["..."]}
  content jsonb,
  created_at timestamptz not null default now()
);
create index idx_course_units_course on public.course_units (course_id, position);

create table public.course_enrollments (
  student_id uuid not null references public.students (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  started_on date not null,
  target_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (student_id, course_id),
  check (target_date >= started_on)
);

create table public.course_unit_progress (
  student_id uuid not null references public.students (id) on delete cascade,
  unit_id uuid not null references public.course_units (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, unit_id)
);
create index idx_course_unit_progress_course on public.course_unit_progress (course_id, student_id);

create table public.writing_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  unit_id uuid not null references public.course_units (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  topic text not null check (char_length(topic) <= 300),
  image_paths text[] not null check (cardinality(image_paths) between 1 and 6),
  note text check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'revise')),
  feedback text check (char_length(feedback) <= 4000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_writing_submissions_status on public.writing_submissions (status, created_at);

create table public.learning_points_settings (
  id smallint primary key default 1 check (id = 1),
  course_complete integer not null default 20 check (course_complete between 0 and 1000),
  writing_approved integer not null default 5 check (writing_approved between 0 and 1000),
  updated_at timestamptz not null default now()
);
insert into public.learning_points_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------- RLS
alter table public.courses enable row level security;
alter table public.course_units enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.course_unit_progress enable row level security;
alter table public.writing_submissions enable row level security;
alter table public.learning_points_settings enable row level security;

create policy courses_select on public.courses for select
  using (published or (select public.has_permission('learning')));
create policy courses_write on public.courses for all
  using ((select public.has_permission('learning')))
  with check ((select public.has_permission('learning')));

create policy course_units_select on public.course_units for select
  using (
    (select public.has_permission('learning'))
    or exists (select 1 from public.courses c where c.id = course_id and c.published)
  );
create policy course_units_write on public.course_units for all
  using ((select public.has_permission('learning')))
  with check ((select public.has_permission('learning')));

create policy course_enrollments_select on public.course_enrollments for select
  using (student_id = (select auth.uid()) or (select public.has_permission('learning')) or public.supervises_student(student_id));
create policy course_enrollments_own on public.course_enrollments for insert
  with check (student_id = (select auth.uid()) and completed_at is null);
create policy course_enrollments_own_update on public.course_enrollments for update
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));
create policy course_enrollments_own_delete on public.course_enrollments for delete
  using (student_id = (select auth.uid()));

create policy course_unit_progress_select on public.course_unit_progress for select
  using (student_id = (select auth.uid()) or (select public.has_permission('learning')) or public.supervises_student(student_id));
create policy course_unit_progress_own_delete on public.course_unit_progress for delete
  using (student_id = (select auth.uid()));

create policy writing_submissions_select on public.writing_submissions for select
  using (student_id = (select auth.uid()) or (select public.has_permission('learning')));
create policy writing_submissions_insert_own on public.writing_submissions for insert
  with check (student_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and feedback is null);
create policy writing_submissions_delete_own_pending on public.writing_submissions for delete
  using (student_id = (select auth.uid()) and status = 'pending');

create policy learning_points_settings_read on public.learning_points_settings for select
  using ((select auth.uid()) is not null);
create policy learning_points_settings_write on public.learning_points_settings for update
  using ((select public.has_permission('learning')))
  with check ((select public.has_permission('learning')));

-- صور تدريبات الكتابة: مخزن خاص، كل طالب في مجلد باسم معرّفه
insert into storage.buckets (id, name, public) values ('learning-submissions', 'learning-submissions', false)
on conflict (id) do nothing;

create policy learning_submissions_insert_own on storage.objects for insert
  with check (bucket_id = 'learning-submissions' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy learning_submissions_read on storage.objects for select
  using (
    bucket_id = 'learning-submissions'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.has_permission('learning')))
  );
create policy learning_submissions_delete_own on storage.objects for delete
  using (bucket_id = 'learning-submissions' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------- إتمام وحدة
-- يسجّل الوحدة، ويُتم الكورس إن اكتملت وحداته كلها، ويمنح نقاط الإتمام إن كان في الموعد
create or replace function public.complete_course_unit(p_unit uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_course uuid;
  enr public.course_enrollments;
  total integer;
  done integer;
  completed_now boolean := false;
  pts integer := 0;
  cfg public.learning_points_settings;
  today date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if uid is null or not exists (select 1 from public.students where id = uid) then
    raise exception 'هذه الميزة للطلاب فقط';
  end if;
  select u.course_id into v_course
  from public.course_units u join public.courses c on c.id = u.course_id
  where u.id = p_unit and c.published;
  if v_course is null then raise exception 'الدرس غير موجود'; end if;

  select * into enr from public.course_enrollments where student_id = uid and course_id = v_course for update;
  if enr.student_id is null then raise exception 'انضم إلى الكورس أولاً'; end if;

  insert into public.course_unit_progress (student_id, unit_id, course_id)
  values (uid, p_unit, v_course)
  on conflict do nothing;

  select count(*) into total from public.course_units where course_id = v_course;
  select count(*) into done from public.course_unit_progress where student_id = uid and course_id = v_course;

  if enr.completed_at is null and done >= total then
    update public.course_enrollments set completed_at = now() where student_id = uid and course_id = v_course;
    completed_now := true;
    select * into cfg from public.learning_points_settings where id = 1;
    if today <= enr.target_date and cfg.course_complete > 0 then
      insert into public.points_entries (student_id, category, points, reason, auto_key)
      values (uid, 'academic', cfg.course_complete,
              'إنهاء كورس: ' || (select title from public.courses where id = v_course),
              'course:' || uid || ':' || v_course)
      on conflict (auto_key) do nothing;
      if found then pts := cfg.course_complete; end if;
    end if;
  end if;

  return jsonb_build_object('done', done, 'total', total, 'course_completed', completed_now, 'points', pts);
end;
$$;

-- ---------------------------------------------------------------- مراجعة الكتابة
-- للإدارة: تحفظ الحالة والملاحظات، وتمنح النقاط عند القبول، وترسل إشعاراً للطالب
create or replace function public.review_writing_submission(p_id uuid, p_status text, p_feedback text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.writing_submissions;
  cfg public.learning_points_settings;
begin
  if not public.has_permission('learning') then
    raise exception 'لا تملك صلاحية المنصة التعليمية';
  end if;
  if p_status not in ('approved', 'revise') then
    raise exception 'حالة غير صحيحة';
  end if;

  update public.writing_submissions
  set status = p_status, feedback = nullif(trim(p_feedback), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id
  returning * into sub;
  if sub.id is null then raise exception 'التسليم غير موجود'; end if;

  if p_status = 'approved' then
    select * into cfg from public.learning_points_settings where id = 1;
    if cfg.writing_approved > 0 then
      insert into public.points_entries (student_id, category, points, reason, auto_key, created_by)
      values (sub.student_id, 'academic', cfg.writing_approved, 'تدريب كتابة: ' || sub.topic, 'writing:' || sub.id, auth.uid())
      on conflict (auto_key) do nothing;
    end if;
  end if;

  insert into public.notifications (title, body, target_type, target_student_id, created_by)
  values (
    case when p_status = 'approved' then 'تمت مراجعة كتابتك ✓' else 'كتابتك تحتاج إعادة' end,
    'الموضوع: ' || sub.topic || coalesce(' — ' || left(nullif(trim(p_feedback), ''), 140), ''),
    'student', sub.student_id, auth.uid()
  );
end;
$$;

revoke execute on function public.complete_course_unit(uuid) from public, anon;
revoke execute on function public.review_writing_submission(uuid, text, text) from public, anon;
grant execute on function public.complete_course_unit(uuid) to authenticated;
grant execute on function public.review_writing_submission(uuid, text, text) to authenticated;

-- ملخص المنضمين لكل كورس للوحة الإدارة
create view public.course_enrollment_progress with (security_invoker = true) as
select e.course_id, e.student_id, e.started_on, e.target_date, e.completed_at,
       (select count(*) from public.course_unit_progress p where p.student_id = e.student_id and p.course_id = e.course_id)::integer as done
from public.course_enrollments e;

grant select on public.course_enrollment_progress to authenticated;

-- بطاقة كل كورس في القائمة: عدد الوحدات ومجموع المدة وعدد المنضمين
create view public.course_catalog with (security_invoker = true) as
select c.id, c.category, c.title, c.description, c.level, c.cover_url, c.published, c.created_at,
       (select count(*) from public.course_units u where u.course_id = c.id)::integer as units,
       (select coalesce(sum(u.duration_seconds), 0) from public.course_units u where u.course_id = c.id)::integer as total_seconds,
       (select count(*) from public.course_enrollments e where e.course_id = c.id)::integer as enrolled
from public.courses c;

grant select on public.course_catalog to authenticated;
