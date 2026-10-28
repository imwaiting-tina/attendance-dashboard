/** 单条员工月度考勤记录（与 Supabase attendance_records 对应） */
export interface AttendanceRecord {
  month: string
  employee_key: string
  employee_name: string
  department: string
  department_group: string
  late_count: number
  severe_late_count: number
  missing_punch_count: number
  proof_y: boolean
  abnormal_days: number
  overtime_hours: number
  annual_leave: number
  comp_leave: number
  sick_leave: number
  personal_leave: number
  bereavement_leave: number
  parental_leave: number
  expected_days: number
  attended_days: number
}

/** 月度合计，用于校验与图表聚合 */
export interface MonthlyTotals {
  late: number
  severeLate: number
  missingPunch: number
  proofCount: number
  abnormalDays: number
  overtimeHours: number
  annualLeave: number
  compLeave: number
  sickLeave: number
  personalLeave: number
  bereavementLeave: number
  parentalLeave: number
  expectedDays: number
  attendedDays: number
}

/** 解析结果 */
export interface ParsedWorkbook {
  month: string | null
  label: string | null
  periodStart: string | null
  periodEnd: string | null
  sourceFile: string
  records: AttendanceRecord[]
  totals: MonthlyTotals
  declaredTotals: Partial<Record<keyof MonthlyTotals, number>>
  warnings: string[]
}

/** 已入库的月份信息（attendance_periods） */
export interface AttendancePeriod {
  month: string
  label: string
  period_start: string | null
  period_end: string | null
  source_file: string | null
  employee_count: number
  imported_at: string
  imported_by: string | null
}

/** 入库前的月度信息（RPC p_period） */
export interface PeriodPayload {
  month: string
  label: string
  period_start: string | null
  period_end: string | null
  source_file: string
  employee_count: number
}
