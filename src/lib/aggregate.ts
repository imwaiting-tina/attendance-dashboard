import type { AttendanceRecord, MonthlyTotals } from './types'

export interface MonthlyPoint extends MonthlyTotals {
  month: string
  /** 实际打卡 / 应出勤；应出勤为 0 时为 null */
  rate: number | null
}

export interface EmployeeSummary {
  employee_key: string
  employee_name: string
  department: string
  department_group: string
  months: number
  lastMonth: string
  late: number
  severeLate: number
  missingPunch: number
  overtimeHours: number
  expectedDays: number
  attendedDays: number
  rate: number | null
}

export function emptyTotals(): MonthlyTotals {
  return {
    late: 0,
    severeLate: 0,
    missingPunch: 0,
    proofCount: 0,
    abnormalDays: 0,
    overtimeHours: 0,
    annualLeave: 0,
    compLeave: 0,
    sickLeave: 0,
    personalLeave: 0,
    bereavementLeave: 0,
    parentalLeave: 0,
    expectedDays: 0,
    attendedDays: 0,
  }
}

export function addRecordToTotals(totals: MonthlyTotals, record: AttendanceRecord): void {
  totals.late += record.late_count
  totals.severeLate += record.severe_late_count
  totals.missingPunch += record.missing_punch_count
  totals.proofCount += record.proof_y ? 1 : 0
  totals.abnormalDays += record.abnormal_days
  totals.overtimeHours += record.overtime_hours
  totals.annualLeave += record.annual_leave
  totals.compLeave += record.comp_leave
  totals.sickLeave += record.sick_leave
  totals.personalLeave += record.personal_leave
  totals.bereavementLeave += record.bereavement_leave
  totals.parentalLeave += record.parental_leave
  totals.expectedDays += record.expected_days
  totals.attendedDays += record.attended_days
}

export function sumRecords(records: AttendanceRecord[]): MonthlyTotals {
  const totals = emptyTotals()
  for (const record of records) addRecordToTotals(totals, record)
  return totals
}

export function rateOf(totals: Pick<MonthlyTotals, 'attendedDays' | 'expectedDays'>): number | null {
  if (totals.expectedDays <= 0) return null
  return totals.attendedDays / totals.expectedDays
}

/** 按月份聚合；只返回实际有记录的月份（离职后不补 0） */
export function aggregateByMonth(records: AttendanceRecord[]): MonthlyPoint[] {
  const byMonth = new Map<string, MonthlyTotals>()
  for (const record of records) {
    if (!record.month) continue
    let totals = byMonth.get(record.month)
    if (!totals) {
      totals = emptyTotals()
      byMonth.set(record.month, totals)
    }
    addRecordToTotals(totals, record)
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => ({
      month,
      ...totals,
      rate: rateOf(totals),
    }))
}

/** 按员工汇总当前筛选范围；展示名/部门取最近月份 */
export function summarizeEmployees(records: AttendanceRecord[]): EmployeeSummary[] {
  const byEmployee = new Map<string, AttendanceRecord[]>()
  for (const record of records) {
    const list = byEmployee.get(record.employee_key)
    if (list) list.push(record)
    else byEmployee.set(record.employee_key, [record])
  }

  const summaries: EmployeeSummary[] = []
  for (const [employeeKey, employeeRecords] of byEmployee) {
    const sorted = [...employeeRecords].sort((a, b) => a.month.localeCompare(b.month))
    const latest = sorted[sorted.length - 1]
    const totals = sumRecords(employeeRecords)
    summaries.push({
      employee_key: employeeKey,
      employee_name: latest.employee_name,
      department: latest.department,
      department_group: latest.department_group,
      months: sorted.length,
      lastMonth: latest.month,
      late: totals.late,
      severeLate: totals.severeLate,
      missingPunch: totals.missingPunch,
      overtimeHours: totals.overtimeHours,
      expectedDays: totals.expectedDays,
      attendedDays: totals.attendedDays,
      rate: rateOf(totals),
    })
  }

  return summaries.sort((a, b) => {
    const riskA = a.late + a.severeLate + a.missingPunch
    const riskB = b.late + b.severeLate + b.missingPunch
    if (riskB !== riskA) return riskB - riskA
    return a.employee_name.localeCompare(b.employee_name, 'zh-Hans-CN')
  })
}

/** 只保留员工姓名/归一化键包含关键词的记录 */
export function filterByEmployeeSearch(records: AttendanceRecord[], keyword: string): AttendanceRecord[] {
  const term = keyword.trim().toLowerCase()
  if (!term) return records
  return records.filter(
    (record) =>
      record.employee_name.toLowerCase().includes(term) || record.employee_key.toLowerCase().includes(term),
  )
}

export function countEmployees(records: AttendanceRecord[]): number {
  return new Set(records.map((record) => record.employee_key)).size
}

/** 部门列表按中文排序 */
export function listDepartments(records: AttendanceRecord[]): string[] {
  return [...new Set(records.map((record) => record.department_group).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'zh-Hans-CN'),
  )
}
