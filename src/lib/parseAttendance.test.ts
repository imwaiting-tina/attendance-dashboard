import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseAttendanceWorkbook } from './parseAttendance'
import { normalizeDepartment, normalizeName } from './normalize'

type Row = unknown[]

function buildWorkbook(sheets: Record<string, Row[]>): Uint8Array {
  const workbook = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name)
  }
  const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Uint8Array(output)
}

const SUMMARY_HEADER = [
  null,
  '序号',
  '员工姓名',
  '部门',
  '迟到',
  '严重迟到',
  '缺卡',
  '上级邮件/证明',
  '考勤异常(天)',
  '加班(小时)',
  '年假(天)',
  '调休(天)',
  '病假(天)',
  '事假(天)',
  '丧假',
  '育儿假',
]

describe('parseAttendanceWorkbook - 1 月格式', () => {
  const buffer = buildWorkbook({
    汇总: [
      [null, '合计', null, null, 2, 0, 1, null, 0.5, 4, 1, 0, 0, 0, 0, 0, 999, 999],
      [null, '2026年1月考勤汇总'],
      [...SUMMARY_HEADER, '年假(天)', '调休(天)'],
      [null, 1, '张三', '财务部1', 2, 0, 1, 'Y', 0.5, 3, 1, 0, 0, 0, 0, 0, 999, 999],
      [null, 2, '李四', '账务部2', 0, 0, 0, '', 0, 1, 0, 0, 0, 0, 0, 0, 999, 999],
    ],
    '财务部-1': [
      [null, '姓名', '工作日', '班次', '打卡1时间', '打卡2时间', '审批单'],
      [null, '张三', '26-01-05', '白班', '08:55', '18:00', null],
      [null, '张三', '26-01-06', '休息', null, null, null],
      [null, '张三', '26-01-07', '白班', null, null, null],
    ],
    '账务部-2': [
      [null, '姓名', '工作日', '班次', '打卡1时间', '打卡2时间', '审批单'],
      [null, '李四', '26-01-05', '白班', '08:59', '18:01', null],
      [null, '李四', '26-01-06', '白班', '09:00', null, null],
    ],
  })

  const parsed = parseAttendanceWorkbook(buffer, '202601考勤表.xlsx')

  it('识别月份、员工与统计周期', () => {
    expect(parsed.month).toBe('2026-01')
    expect(parsed.label).toBe('2026年1月')
    expect(parsed.records).toHaveLength(2)
    expect(parsed.periodStart).toBe('2026-01-05')
    expect(parsed.periodEnd).toBe('2026-01-07')
  })

  it('读取指标并只取「加班」之后的第一个假期列', () => {
    const zhang = parsed.records.find((record) => record.employee_key === '张三')
    expect(zhang).toBeDefined()
    expect(zhang?.late_count).toBe(2)
    expect(zhang?.missing_punch_count).toBe(1)
    expect(zhang?.proof_y).toBe(true)
    expect(zhang?.overtime_hours).toBe(3)
    expect(zhang?.annual_leave).toBe(1)
    expect(zhang?.expected_days).toBe(2)
    expect(zhang?.attended_days).toBe(1)
  })

  it('按明细计算应出勤/实际打卡，休息日不计入', () => {
    expect(parsed.totals.expectedDays).toBe(4)
    expect(parsed.totals.attendedDays).toBe(3)
    expect(parsed.totals.attendedDays / parsed.totals.expectedDays).toBeCloseTo(0.75)
  })

  it('与汇总表第 1 行合计一致，并提示部门归组', () => {
    expect(parsed.warnings.some((warning) => warning.includes('合计为'))).toBe(false)
    expect(parsed.warnings.some((warning) => warning.includes('账务部2→账务部'))).toBe(true)
  })
})

describe('parseAttendanceWorkbook - 统计周期过滤', () => {
  it('忽略混入上上个月的零星日期，避免周期起点被拉偏', () => {
    const buffer = buildWorkbook({
      汇总: [
        [null, '合计', null, null, 0, 0, 0, null, 0, 0, 0, 0, 0, 0, 0, 0],
        [null, '2026年1月考勤汇总'],
        SUMMARY_HEADER,
        [null, 1, '张三', '财务部', 0, 0, 0, '', 0, 0, 0, 0, 0, 0, 0, 0],
      ],
      财务部: [
        [null, '姓名', '工作日', '班次', '打卡1时间', '打卡2时间'],
        [null, '张三', '25-11-26', '白班', '09:00', '18:00'],
        [null, '张三', '25-12-26', '白班', '09:00', '18:00'],
        [null, '张三', '26-01-05', '白班', '09:00', '18:00'],
      ],
    })
    const parsed = parseAttendanceWorkbook(buffer, '202601考勤表.xlsx')
    expect(parsed.periodStart).toBe('2025-12-26')
    expect(parsed.periodEnd).toBe('2026-01-05')
    expect(parsed.totals.expectedDays).toBe(2)
    expect(parsed.totals.attendedDays).toBe(2)
    expect(parsed.warnings.some((warning) => warning.includes('不在统计周期内'))).toBe(true)
  })
})

describe('parseAttendanceWorkbook - 9 月格式', () => {
  const buffer = buildWorkbook({
    汇总: [
      [null, '合计', null, null, 0, 0, 0, null, 0, 0, 1, 0, 0, 0, 0, 0],
      [null, '2026年9月考勤汇总'],
      SUMMARY_HEADER,
      [null, 1, '赖淑贤', '财务部', 0, 0, 0, '', 0, 0, 1, 0, 0, 0, 0, 0],
      [null, 2, '任梦超', '技术部', 0, 0, 0, '', 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    有年假: [
      [null, '姓名', '工作日', '班次', '打卡1时间', '打卡2时间'],
      [null, '賴淑賢', '26-09-01', '白班', '09:00', '18:00'],
      [null, '賴淑賢', '26-09-01', '白班', '09:00', '18:00'],
      [null, '賴淑賢', '26-09-02', '休息', null, null],
      [null, '賴淑賢', '26-09-03', '白班', null, null],
    ],
    '任梦超-线上远程': [
      [null, '姓名', '工作日', '班次', '首次入会时间', '最后退会时间', '累计参会时长'],
      [null, '任梦超', '26-09-01', '远程', null, null, '120分钟'],
      [null, '任梦超', '26-09-02', '远程', null, null, null],
    ],
  })

  it('识别远程参会时长与繁简姓名，并提示重复日期', () => {
    const parsed = parseAttendanceWorkbook(buffer, '考勤表.xlsx', '2026-09')
    expect(parsed.month).toBe('2026-09')
    expect(parsed.warnings.some((warning) => warning.includes('重复记录'))).toBe(true)

    const lai = parsed.records.find((record) => record.employee_key === '赖淑贤')
    const ren = parsed.records.find((record) => record.employee_key === '任梦超')
    expect(lai?.expected_days).toBe(2)
    expect(lai?.attended_days).toBe(1)
    expect(ren?.expected_days).toBe(2)
    expect(ren?.attended_days).toBe(1)
    expect(parsed.totals.expectedDays).toBe(4)
    expect(parsed.totals.attendedDays).toBe(2)
  })

  it('文件名无法识别月份时给出警告', () => {
    const parsed = parseAttendanceWorkbook(buffer, '考勤表.xlsx')
    expect(parsed.month).toBeNull()
    expect(parsed.warnings.some((warning) => warning.includes('未能从文件名识别月份'))).toBe(true)
  })

  it('汇总第 1 行公式漏行时给出以员工行为准的警告', () => {
    const staleBuffer = buildWorkbook({
      汇总: [
        [null, '合计', null, null, 0, 0, 1, null, 0, 0, 0, 0, 0, 0, 0, 0],
        [null, '2026年9月考勤汇总'],
        SUMMARY_HEADER,
        [null, 1, '王五', '财务部', 0, 0, 2, '', 0, 0, 0, 0, 0, 0, 0, 0],
      ],
      有年假: [
        [null, '姓名', '工作日', '班次', '打卡1时间', '打卡2时间'],
        [null, '王五', '26-09-01', '白班', '09:00', '18:00'],
      ],
    })
    const parsed = parseAttendanceWorkbook(staleBuffer, '202609考勤表.xlsx')
    expect(parsed.warnings.some((warning) => warning.includes('「缺卡」合计为 1，员工行合计为 2'))).toBe(
      true,
    )
  })
})

describe('parseAttendanceWorkbook - 超大 dimension', () => {
  it('汇总与明细被格式撑大时仍能按有效行解析', () => {
    const workbook = XLSX.utils.book_new()
    const summarySheet = XLSX.utils.aoa_to_sheet([
      [null, '合计', null, null, 0, 0, 0, null, 0, 0, 0, 0, 0, 0, 0, 0],
      [null, '2026年10月考勤汇总'],
      SUMMARY_HEADER,
      [null, 1, '赵六', '财务部', 0, 0, 0, '', 0, 0, 0, 0, 0, 0, 0, 0],
    ])
    summarySheet['!ref'] = 'A1:Z6000'
    XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总')

    const detailSheet = XLSX.utils.aoa_to_sheet([
      [null, '姓名', '工作日', '班次', '打卡1时间', '打卡2时间'],
      [null, '赵六', '26-10-08', '白班', '09:00', '18:00'],
    ])
    detailSheet['!ref'] = 'A1:G6000'
    XLSX.utils.book_append_sheet(workbook, detailSheet, '有年假')

    const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const parsed = parseAttendanceWorkbook(new Uint8Array(output), '202610考勤表.xlsx')

    expect(parsed.month).toBe('2026-10')
    expect(parsed.records).toHaveLength(1)
    expect(parsed.records[0].employee_name).toBe('赵六')
    expect(parsed.totals.expectedDays).toBe(1)
    expect(parsed.totals.attendedDays).toBe(1)
    expect(parsed.warnings.some((warning) => warning.includes('超过 5000 行'))).toBe(true)
  })
})

describe('parseAttendanceWorkbook - 补卡状态与异常备注', () => {
  it('保留 Y/N 原始状态，并读取考勤异常右侧备注；Y 按人计数', () => {
    const header = [
      null,
      '序号',
      '员工姓名',
      '部门',
      '迟到',
      '严重迟到',
      '缺卡',
      '上级邮件/证明',
      '考勤异常(天)',
      '备注',
      '加班(小时)',
      '年假(天)',
      '调休(天)',
      '病假(天)',
      '事假(天)',
      '丧假',
      '育儿假',
    ]
    const buffer = buildWorkbook({
      汇总: [
        [null, '合计', null, null, 0, 0, 7, null, 1, null, 4, 0, 0, 0, 0, 0, 0],
        [null, '2026年1月考勤汇总'],
        header,
        [null, 1, '李欣怡', '财务部', 0, 0, 1, 'N', 0.5, '旷工半天', 1, 0, 0, 0, 0, 0, 0],
        [null, 2, '李佳', '财务部', 0, 0, 1, 'Y', 0.5, '迟到超过1个小时算旷工半天', 2, 0, 0, 0, 0, 0, 0],
        [null, 3, '王五', '财务部', 0, 0, 5, 'Y', 0, '', 1, 0, 0, 0, 0, 0, 0],
      ],
      财务部: [
        [null, '姓名', '工作日', '班次', '打卡1时间', '打卡2时间'],
        [null, '李欣怡', '26-01-05', '白班', '09:00', '18:00'],
        [null, '李佳', '26-01-05', '白班', '09:00', '18:00'],
        [null, '王五', '26-01-05', '白班', '09:00', '18:00'],
      ],
    })

    const parsed = parseAttendanceWorkbook(buffer, '202601考勤表.xlsx')
    const liXinyi = parsed.records.find((record) => record.employee_key === '李欣怡')
    const liJia = parsed.records.find((record) => record.employee_key === '李佳')
    const wangWu = parsed.records.find((record) => record.employee_key === '王五')

    expect(liXinyi?.proof_y).toBe(false)
    expect(liXinyi?.proof_status).toBe('N')
    expect(liXinyi?.abnormal_days).toBe(0.5)
    expect(liXinyi?.abnormal_remark).toBe('旷工半天')

    expect(liJia?.proof_y).toBe(true)
    expect(liJia?.proof_status).toBe('Y')
    expect(liJia?.abnormal_remark).toBe('迟到超过1个小时算旷工半天')

    expect(wangWu?.proof_status).toBe('Y')
    // 李佳缺卡 1 次、王五缺卡 5 次，但都是 Y，补卡人数应为 2 人而不是 6 次
    expect(parsed.totals.proofCount).toBe(2)
    expect(parsed.totals.missingPunch).toBe(7)
  })
})

describe('姓名与部门归一化', () => {
  it('繁转简、英文别名与空白处理', () => {
    expect(normalizeName('賴淑賢')).toBe('赖淑贤')
    expect(normalizeName('Yvonne Lai')).toBe('赖淑贤')
    expect(normalizeName(' 张 三 ')).toBe('张三')
  })

  it('部门改名归一组', () => {
    expect(normalizeDepartment('香港财务部')).toBe('香港办')
    expect(normalizeDepartment('账务部2')).toBe('账务部')
    expect(normalizeDepartment('行政保洁部')).toBe('行政部-保洁')
    expect(normalizeDepartment('财务部1')).toBe('财务部1')
  })
})
