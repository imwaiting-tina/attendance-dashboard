import { describe, expect, it } from 'vitest'
import {
  canShowMovingAverage,
  departmentNameOf,
  filterAndSortEmployeesByCondition,
  sortDepartmentsByMetric,
  summarizeDepartments,
  summarizeEmployees,
} from './aggregate'
import type { EmployeeSummary } from './aggregate'
import type { AttendanceRecord } from './types'

const points = (months: string[]) => months.map((month) => ({ month }))

function record(overrides: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    month: '2026-10',
    employee_key: 'employee',
    employee_name: '员工',
    department: '部门',
    department_group: '部门',
    late_count: 0,
    severe_late_count: 0,
    missing_punch_count: 0,
    proof_y: false,
    proof_status: '',
    abnormal_days: 0,
    abnormal_remark: '',
    overtime_hours: 0,
    annual_leave: 0,
    comp_leave: 0,
    sick_leave: 0,
    personal_leave: 0,
    bereavement_leave: 0,
    parental_leave: 0,
    expected_days: 0,
    attended_days: 0,
    ...overrides,
  }
}

describe('canShowMovingAverage', () => {
  it('连续且不少于 3 个月时才计算移动平均', () => {
    expect(canShowMovingAverage(points(['2026-01', '2026-02', '2026-03']))).toBe(true)
    expect(canShowMovingAverage(points(['2026-11', '2026-12', '2027-01']))).toBe(true)
  })

  it('单月、两个月或非连续月份不计算移动平均', () => {
    expect(canShowMovingAverage(points(['2026-09']))).toBe(false)
    expect(canShowMovingAverage(points(['2026-08', '2026-09']))).toBe(false)
    expect(canShowMovingAverage(points(['2026-01', '2026-03', '2026-04']))).toBe(false)
  })
})

describe('部门汇总', () => {
  const records = [
    record({
      employee_key: 'a',
      department_group: '财务部',
      late_count: 2,
      severe_late_count: 1,
      missing_punch_count: 3,
      abnormal_days: 0.5,
      annual_leave: 1,
      comp_leave: 2,
    }),
    record({
      month: '2026-09',
      employee_key: 'a',
      department_group: '财务部',
      missing_punch_count: 1,
      sick_leave: 1.5,
    }),
    record({
      employee_key: 'b',
      department_group: '财务部',
      late_count: 1,
      proof_y: true,
    }),
    record({
      employee_key: 'c',
      department_group: '客服部',
      personal_leave: 2,
    }),
    record({
      employee_key: 'd',
      department_group: '   ',
    }),
  ]

  it('按部门汇总指标，并去重统计员工人数', () => {
    const summary = summarizeDepartments(records)
    const finance = summary.find((item) => item.department === '财务部')

    expect(finance).toMatchObject({
      employeeCount: 2,
      late: 3,
      severeLate: 1,
      lateTotal: 4,
      missingPunch: 4,
      proofCount: 1,
      abnormalDays: 0.5,
      leaveTotal: 4.5,
    })
    expect(summary.find((item) => item.department === '客服部')?.leaveTotal).toBe(2)
    expect(summary.find((item) => item.department === '未分部门')?.employeeCount).toBe(1)
  })

  it('按指定指标正序/倒序排列，数值相同时按部门名排序', () => {
    const summary = summarizeDepartments(records)
    const descending = sortDepartmentsByMetric(summary, 'leaveTotal', 'desc')
    const ascending = sortDepartmentsByMetric(summary, 'leaveTotal', 'asc')

    expect(descending.map((item) => item.department)).toEqual(['财务部', '客服部', '未分部门'])
    expect(ascending.map((item) => item.department)).toEqual(['未分部门', '客服部', '财务部'])
  })

  it('空部门统一归为「未分部门」', () => {
    expect(departmentNameOf(record({ department_group: '' }))).toBe('未分部门')
    expect(departmentNameOf(record({ department_group: '财务部' }))).toBe('财务部')
  })
})

function employeeSummary(overrides: Partial<EmployeeSummary>): EmployeeSummary {
  return {
    employee_key: 'employee',
    employee_name: '员工',
    department: '部门',
    department_group: '部门',
    months: 1,
    lastMonth: '2026-10',
    late: 0,
    severeLate: 0,
    missingPunch: 0,
    leaveTotal: 0,
    overtimeHours: 0,
    expectedDays: 0,
    attendedDays: 0,
    rate: null,
    ...overrides,
  }
}

describe('员工概览按考勤情况筛选', () => {
  const employees = [
    employeeSummary({
      employee_key: 'a',
      employee_name: '员工A',
      late: 2,
      severeLate: 1,
      missingPunch: 4,
      leaveTotal: 2,
    }),
    employeeSummary({
      employee_key: 'b',
      employee_name: '员工B',
      late: 4,
      severeLate: 0,
      missingPunch: 1,
      leaveTotal: 3.5,
    }),
    employeeSummary({
      employee_key: 'c',
      employee_name: '员工C',
      late: 0,
      severeLate: 0,
      missingPunch: 0,
      leaveTotal: 0,
    }),
  ]

  it('迟到按迟到 + 严重迟到合计过滤并降序', () => {
    const result = filterAndSortEmployeesByCondition(employees, 'late')
    expect(result.map((item) => item.employee_name)).toEqual(['员工B', '员工A'])
  })

  it('缺卡按缺卡次数过滤并降序', () => {
    const result = filterAndSortEmployeesByCondition(employees, 'missing')
    expect(result.map((item) => item.employee_name)).toEqual(['员工A', '员工B'])
  })

  it('请假按请假天数过滤并降序', () => {
    const result = filterAndSortEmployeesByCondition(employees, 'leave')
    expect(result.map((item) => item.employee_name)).toEqual(['员工B', '员工A'])
  })

  it('数值相同时按姓名正序，且不改变原数组顺序', () => {
    const tied = [
      employeeSummary({ employee_key: 'b', employee_name: 'Bob', missingPunch: 2 }),
      employeeSummary({ employee_key: 'a', employee_name: 'Amy', missingPunch: 2 }),
    ]
    const result = filterAndSortEmployeesByCondition(tied, 'missing')

    expect(result.map((item) => item.employee_name)).toEqual(['Amy', 'Bob'])
    expect(tied.map((item) => item.employee_name)).toEqual(['Bob', 'Amy'])
  })

  it('未指定情况时保持原数组', () => {
    expect(filterAndSortEmployeesByCondition(employees, null)).toBe(employees)
  })

  it('员工汇总的请假天数包含六类假期', () => {
    const summaries = summarizeEmployees([
      record({
        employee_key: 'leave',
        employee_name: '请假员工',
        month: '2026-08',
        annual_leave: 1,
        comp_leave: 0.5,
      }),
      record({
        employee_key: 'leave',
        employee_name: '请假员工',
        month: '2026-09',
        sick_leave: 1,
        personal_leave: 1,
        bereavement_leave: 1,
        parental_leave: 1,
      }),
    ])

    expect(summaries[0].leaveTotal).toBe(5.5)
  })
})
