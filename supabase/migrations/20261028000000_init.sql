-- 考勤汇总仪表盘：表结构、RLS 与原子导入函数

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_periods (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  label text not null,
  period_start date,
  period_end date,
  source_file text,
  employee_count integer not null default 0,
  imported_at timestamptz not null default now(),
  imported_by uuid
);

create table if not exists public.attendance_records (
  id bigint generated always as identity primary key,
  month text not null references public.attendance_periods (month) on delete cascade,
  employee_key text not null,
  employee_name text not null,
  department text not null default '',
  department_group text not null default '',
  late_count numeric not null default 0,
  severe_late_count numeric not null default 0,
  missing_punch_count numeric not null default 0,
  proof_y boolean not null default false,
  abnormal_days numeric not null default 0,
  overtime_hours numeric not null default 0,
  annual_leave numeric not null default 0,
  comp_leave numeric not null default 0,
  sick_leave numeric not null default 0,
  personal_leave numeric not null default 0,
  bereavement_leave numeric not null default 0,
  parental_leave numeric not null default 0,
  expected_days integer not null default 0,
  attended_days integer not null default 0,
  created_at timestamptz not null default now(),
  unique (month, employee_key)
);

create index if not exists attendance_records_month_idx on public.attendance_records (month);
create index if not exists attendance_records_department_idx on public.attendance_records (department_group);
create index if not exists attendance_records_employee_idx on public.attendance_records (employee_key);

-- 管理员判断：只认 app_admins 中登记过的 auth 用户
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.app_admins where user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to authenticated;

alter table public.app_admins enable row level security;
alter table public.attendance_periods enable row level security;
alter table public.attendance_records enable row level security;

drop policy if exists "admins read periods" on public.attendance_periods;
create policy "admins read periods"
  on public.attendance_periods
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins read records" on public.attendance_records;
create policy "admins read records"
  on public.attendance_records
  for select
  to authenticated
  using (public.is_admin());

-- 前端不直接写表，只通过下面的函数原子导入/删除

create or replace function public.import_attendance(p_period jsonb, p_records jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_month text := p_period ->> 'month';
  v_is_service boolean := coalesce(auth.role() = 'service_role', false);
begin
  if v_month is null or v_month !~ '^\d{4}-\d{2}$' then
    raise exception '月份格式错误：%', v_month;
  end if;

  if not v_is_service and not public.is_admin() then
    raise exception '无导入权限';
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception '记录数据格式错误';
  end if;

  insert into public.attendance_periods (
    month, label, period_start, period_end, source_file, employee_count, imported_at, imported_by
  ) values (
    v_month,
    coalesce(nullif(p_period ->> 'label', ''), v_month),
    nullif(p_period ->> 'period_start', '')::date,
    nullif(p_period ->> 'period_end', '')::date,
    nullif(p_period ->> 'source_file', ''),
    coalesce((p_period ->> 'employee_count')::integer, jsonb_array_length(p_records)),
    now(),
    auth.uid()
  )
  on conflict (month) do update set
    label = excluded.label,
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    source_file = excluded.source_file,
    employee_count = excluded.employee_count,
    imported_at = now(),
    imported_by = excluded.imported_by;

  delete from public.attendance_records where month = v_month;

  insert into public.attendance_records (
    month, employee_key, employee_name, department, department_group,
    late_count, severe_late_count, missing_punch_count, proof_y, abnormal_days,
    overtime_hours, annual_leave, comp_leave, sick_leave, personal_leave,
    bereavement_leave, parental_leave, expected_days, attended_days
  )
  select
    v_month, r.employee_key, r.employee_name,
    coalesce(r.department, ''), coalesce(r.department_group, ''),
    coalesce(r.late_count, 0), coalesce(r.severe_late_count, 0),
    coalesce(r.missing_punch_count, 0), coalesce(r.proof_y, false),
    coalesce(r.abnormal_days, 0), coalesce(r.overtime_hours, 0),
    coalesce(r.annual_leave, 0), coalesce(r.comp_leave, 0),
    coalesce(r.sick_leave, 0), coalesce(r.personal_leave, 0),
    coalesce(r.bereavement_leave, 0), coalesce(r.parental_leave, 0),
    coalesce(r.expected_days, 0), coalesce(r.attended_days, 0)
  from jsonb_to_recordset(p_records) as r(
    employee_key text,
    employee_name text,
    department text,
    department_group text,
    late_count numeric,
    severe_late_count numeric,
    missing_punch_count numeric,
    proof_y boolean,
    abnormal_days numeric,
    overtime_hours numeric,
    annual_leave numeric,
    comp_leave numeric,
    sick_leave numeric,
    personal_leave numeric,
    bereavement_leave numeric,
    parental_leave numeric,
    expected_days integer,
    attended_days integer
  );
end;
$$;

revoke all on function public.import_attendance(jsonb, jsonb) from public;
grant execute on function public.import_attendance(jsonb, jsonb) to authenticated, service_role;

create or replace function public.delete_attendance_period(p_month text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role() = 'service_role', false) = false and not public.is_admin() then
    raise exception '无删除权限';
  end if;

  delete from public.attendance_periods where month = p_month;
end;
$$;

revoke all on function public.delete_attendance_period(text) from public;
grant execute on function public.delete_attendance_period(text) to authenticated, service_role;
