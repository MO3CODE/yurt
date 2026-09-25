-- =====================================================================
-- 0007 — صلاحيات الإداريين حسب الأقسام
-- المدير العام يملك كل شيء ضمنياً؛ الإداري يملك ما في permissions فقط.
-- الواجهة تفرض الصلاحيات في كل صفحة و Server Action (src/lib/auth/permissions.ts).
-- =====================================================================

alter table public.profiles
  add column if not exists permissions text[] not null default '{}';

-- الإداريون الحاليون يحتفظون بكامل صلاحياتهم (لا شيء يتعطل بعد التطبيق)
update public.profiles
set permissions = array[
  'students', 'apartments', 'attendance', 'prayers', 'quran', 'health',
  'academic', 'complaints', 'cleaning', 'facilities',
  'points', 'alerts', 'notifications', 'reports'
]
where role = 'admin' and permissions = '{}';

-- للاستخدام في سياسات RLS لاحقاً: has_permission('complaints')
create or replace function public.has_permission(p text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' or (role = 'admin' and p = any(permissions))
     from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke execute on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated, service_role;

-- حماية عمود الصلاحيات: لا يعدّله إلا المدير العام أو السيرفر
-- (تحلّ محل نسخة 0005 وتضيف permissions إلى الأعمدة المحمية)
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role <> 'student' or new.manage_academic or new.manage_religious
       or new.manage_facilities or new.manage_reports or cardinality(new.permissions) > 0 then
      raise exception 'غير مسموح بتعيين الصلاحيات';
    end if;
  elsif new.role is distinct from old.role
     or new.permissions is distinct from old.permissions
     or new.manage_academic is distinct from old.manage_academic
     or new.manage_religious is distinct from old.manage_religious
     or new.manage_facilities is distinct from old.manage_facilities
     or new.manage_reports is distinct from old.manage_reports then
    raise exception 'غير مسموح بتعديل الصلاحيات';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

revoke execute on function public.guard_profile_privileged_columns() from public, anon, authenticated;
