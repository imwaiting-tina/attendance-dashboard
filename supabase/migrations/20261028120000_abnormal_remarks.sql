-- 补卡证明原始状态与考勤异常备注
-- 用户口径：Y 表示当月缺卡均已补上（每人每月只计 1 人）；N 表示存在考勤异常，
-- 「考勤异常（天）」右侧的「备注」列用于补充说明异常原因。

alter table public.attendance_records
  add column if not exists proof_status text not null default '',
  add column if not exists abnormal_remark text not null default '';

-- 替换导入函数，带上新增字段
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
    late_count, severe_late_count, missing_punch_count, proof_y, proof_status,
    abnormal_days, abnormal_remark,
    overtime_hours, annual_leave, comp_leave, sick_leave, personal_leave,
    bereavement_leave, parental_leave, expected_days, attended_days
  )
  select
    v_month, r.employee_key, r.employee_name,
    coalesce(r.department, ''), coalesce(r.department_group, ''),
    coalesce(r.late_count, 0), coalesce(r.severe_late_count, 0),
    coalesce(r.missing_punch_count, 0), coalesce(r.proof_y, false),
    coalesce(r.proof_status, ''),
    coalesce(r.abnormal_days, 0), coalesce(r.abnormal_remark, ''),
    coalesce(r.overtime_hours, 0),
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
    proof_status text,
    abnormal_days numeric,
    abnormal_remark text,
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
