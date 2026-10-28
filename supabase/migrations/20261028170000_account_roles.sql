-- 账号体系：启用账号都可只读查看数据，app_admins 中的启用账号才拥有管理权限
-- 停用账号通过 Supabase Auth 的 banned_until 实现，RLS 同样会拒绝其读取业务表。

-- 当前 JWT 对应的账号是否处于启用状态（未封禁）
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

revoke all on function public.is_active_user() from public;
grant execute on function public.is_active_user() to authenticated;

-- 管理员必须同时满足：账号已启用 + 在 app_admins 名单中
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and exists (
      select 1 from public.app_admins where user_id = auth.uid()
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 登录后一次性返回账号上下文：账号名、是否启用、是否管理员
create or replace function public.account_context()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'account',
    case
      when u.email ilike '%@attendance.local' then split_part(u.email, '@', 1)
      else u.email
    end,
    'active', (u.banned_until is null or u.banned_until <= now()),
    'is_admin', exists (
      select 1 from public.app_admins a where a.user_id = u.id
    )
  )
  from auth.users u
  where u.id = auth.uid();
$$;

revoke all on function public.account_context() from public;
grant execute on function public.account_context() to authenticated;

-- 启用账号可只读查看考勤数据；导入和删除仍由 is_admin() 控制
drop policy if exists "admins read periods" on public.attendance_periods;
drop policy if exists "active users read periods" on public.attendance_periods;
create policy "active users read periods"
  on public.attendance_periods
  for select
  to authenticated
  using (public.is_active_user());

drop policy if exists "admins read records" on public.attendance_records;
drop policy if exists "active users read records" on public.attendance_records;
create policy "active users read records"
  on public.attendance_records
  for select
  to authenticated
  using (public.is_active_user());
