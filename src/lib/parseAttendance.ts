import * as XLSX from 'xlsx'
import { detectMonthFromFileName, formatMonthLabel, normalizeDepartment, normalizeName, parseShortDate } from './normalize'
import type { AttendanceRecord, MonthlyTotals, ParsedWorkbook } from './types'

/** 跳过的工作表 */
const SKIP_SHEETS = new Set(['汇总', '核对', '透视表'])
const MAX_SHEET_ROWS = 5000

type Row = unknown[]

/** 表头归一化：去空白、全角括号转半角、去冒号 */
function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/：/g, '')
    .trim()
}

/** 把单元格转成数字，空值/文本按 0 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const text = String(value).replace(/,/g, '').trim()
  if (!text) return 0
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : 0
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

function cellText(value: unknown): string {
  return String(value ?? '').trim()
}

/** 在若干行内找到同时包含指定表头的行 */
function findHeaderRow(
  rows: Row[],
  required: string[],
  maxScan = 10,
): { index: number; headers: string[] } | null {
  const limit = Math.min(rows.length, maxScan)
  for (let i = 0; i < limit; i += 1) {
    const headers = (rows[i] ?? []).map(normalizeHeader)
    if (required.every((name) => headers.includes(name))) {
      return { index: i, headers }
    }
  }
  return null
}

/** 在 start 之后查找表头，避免取到余额区重复列 */
function indexOfAfter(headers: string[], target: string, start: number): number {
  for (let i = Math.max(0, start); i < headers.length; i += 1) {
    if (headers[i] === target) return i
  }
  return -1
}

interface SummaryColumnMap {
  name: number
  department: number
  late: number
  severeLate: number
  missingPunch: number
  proof: number
  abnormalDays: number
  overtimeHours: number
  annualLeave: number
  compLeave: number
  sickLeave: number
  personalLeave: number
  bereavementLeave: number
  parentalLeave: number
}

/** 从汇总表头解析列位置；假期列只取「加班」之后的第一次出现 */
function buildSummaryColumns(headers: string[]): SummaryColumnMap {
  const overtime = indexOfAfter(headers, '加班(小时)', 0)
  return {
    name: indexOfAfter(headers, '员工姓名', 0),
    department: indexOfAfter(headers, '部门', 0),
    late: indexOfAfter(headers, '迟到', 0),
    severeLate: indexOfAfter(headers, '严重迟到', 0),
    missingPunch: indexOfAfter(headers, '缺卡', 0),
    proof: headers.findIndex((header) => header.startsWith('上级邮件')),
    abnormalDays: indexOfAfter(headers, '考勤异常(天)', 0),
    overtimeHours: overtime,
    annualLeave: indexOfAfter(headers, '年假(天)', overtime + 1),
    compLeave: indexOfAfter(headers, '调休(天)', overtime + 1),
    sickLeave: indexOfAfter(headers, '病假(天)', overtime + 1),
    personalLeave: indexOfAfter(headers, '事假(天)', overtime + 1),
    bereavementLeave: indexOfAfter(headers, '丧假', overtime + 1),
    parentalLeave: indexOfAfter(headers, '育儿假', overtime + 1),
  }
}

interface DetailAggregate {
  expected: number
  attended: number
}

interface DetailParseResult {
  byName: Map<string, DetailAggregate>
  periodStart: string | null
  periodEnd: string | null
  rawNames: Set<string>
  duplicateDays: number
}

/** 判断明细日期是否落在当月统计周期内（允许上月 20 日以后开始） */
function isDateInPeriod(day: string, month: string): boolean {
  if (day.startsWith(month)) return true
  const [year, monthNumber] = month.split('-').map(Number)
  // Date.UTC 的月份从 0 开始，monthNumber - 2 即上个月
  const previousStart = new Date(Date.UTC(year, monthNumber - 2, 20))
  return day >= previousStart.toISOString().slice(0, 10) && day < `${month}-01`
}

/** 解析所有明细工作表，统计每人应出勤/实际打卡天数 */
function parseDetailSheets(
  workbook: XLSX.WorkBook,
  month: string | null,
  warnings: string[],
): DetailParseResult {
  const byName = new Map<string, DetailAggregate>()
  const rawNames = new Set<string>()
  const seenDays = new Set<string>()
  let periodStart: string | null = null
  let periodEnd: string | null = null
  let duplicateDays = 0
  const outsideDates = new Set<string>()
  let outsideRows = 0

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.has(sheetName)) continue
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const fullRef = (sheet as XLSX.WorkSheet & { '!fullref'?: string })['!fullref'] ?? sheet['!ref']
    if (fullRef) {
      const range = XLSX.utils.decode_range(fullRef)
      if (range.e.r + 1 > MAX_SHEET_ROWS) {
        warnings.push(`工作表「${sheetName}」超过 ${MAX_SHEET_ROWS} 行，已截断`)
      }
    }

    const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    })
    const header = findHeaderRow(rows, ['姓名', '工作日'], 6)
    if (!header) continue

    const { headers } = header
    const nameIndex = headers.indexOf('姓名')
    const workdayIndex = headers.indexOf('工作日')
    const shiftIndex = headers.indexOf('班次')
    const punchIndexes = ['打卡1时间', '打卡2时间', '首次入会时间', '最后退会时间', '累计参会时长']
      .map((name) => headers.indexOf(name))
      .filter((index) => index >= 0)

    if (shiftIndex < 0 || punchIndexes.length === 0) continue

    for (let i = header.index + 1; i < rows.length; i += 1) {
      const row = rows[i] ?? []
      const rawName = cellText(row[nameIndex])
      const workday = parseShortDate(row[workdayIndex])
      if (!rawName || !workday) continue

      // 原表偶尔混入上上个月的零星日期（如 1 月表里的 2025-11-26），不计入统计周期
      if (month && !isDateInPeriod(workday, month)) {
        outsideDates.add(workday)
        outsideRows += 1
        continue
      }

      if (!periodStart || workday < periodStart) periodStart = workday
      if (!periodEnd || workday > periodEnd) periodEnd = workday

      const shift = cellText(row[shiftIndex])
      if (!shift || shift.includes('休息')) continue

      const employeeKey = normalizeName(rawName)
      if (!employeeKey) continue
      rawNames.add(rawName)

      const dayKey = `${employeeKey}|${workday}`
      if (seenDays.has(dayKey)) {
        duplicateDays += 1
        continue
      }
      seenDays.add(dayKey)

      const aggregate = byName.get(employeeKey) ?? { expected: 0, attended: 0 }
      aggregate.expected += 1
      if (punchIndexes.some((index) => !isBlank(row[index]))) {
        aggregate.attended += 1
      }
      byName.set(employeeKey, aggregate)
    }
  }

  if (duplicateDays > 0) {
    warnings.push(`明细中发现 ${duplicateDays} 条同一人同一天的重复记录，已去重`)
  }
  if (outsideRows > 0) {
    const examples = [...outsideDates].slice(0, 3).join('、')
    warnings.push(
      `明细中有 ${outsideRows} 条日期不在统计周期内（${examples}${outsideDates.size > 3 ? ' 等' : ''}），已忽略`,
    )
  }

  return { byName, periodStart, periodEnd, rawNames, duplicateDays }
}

function emptyTotals(): MonthlyTotals {
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

/**
 * 解析一份月度考勤 Excel。
 * @param input 文件内容（浏览器 File.arrayBuffer() 或 Node Buffer）
 * @param fileName 文件名，用于识别月份
 * @param overrideMonth 手动指定月份（YYYY-MM），用于文件名无法识别时
 */
export function parseAttendanceWorkbook(
  input: ArrayBuffer | Uint8Array,
  fileName: string,
  overrideMonth?: string | null,
): ParsedWorkbook {
  const warnings: string[] = []
  const data = input instanceof Uint8Array ? input : new Uint8Array(input)
  const workbook = XLSX.read(data, {
    type: 'array',
    sheetRows: MAX_SHEET_ROWS,
    cellDates: false,
  })

  const month = overrideMonth || detectMonthFromFileName(fileName)
  if (!month) {
    warnings.push('未能从文件名识别月份，请在导入前手动选择月份')
  }
  const label = month ? formatMonthLabel(month) : null

  const summarySheet = workbook.Sheets['汇总']
  if (!summarySheet) {
    throw new Error('未找到「汇总」工作表，请确认这是考勤汇总表')
  }

  const summaryRows = XLSX.utils.sheet_to_json<Row>(summarySheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })
  const summaryHeader = findHeaderRow(summaryRows, ['员工姓名', '部门'], 10)
  if (!summaryHeader) {
    throw new Error('「汇总」表未找到员工姓名/部门表头')
  }

  const columns = buildSummaryColumns(summaryHeader.headers)
  if (columns.name < 0 || columns.department < 0) {
    throw new Error('「汇总」表缺少员工姓名或部门列')
  }

  const requiredColumns: Array<[keyof SummaryColumnMap, string]> = [
    ['late', '迟到'],
    ['missingPunch', '缺卡'],
    ['abnormalDays', '考勤异常（天）'],
    ['overtimeHours', '加班（小时）'],
  ]
  for (const [field, labelText] of requiredColumns) {
    if (columns[field] < 0) warnings.push(`「汇总」表缺少「${labelText}」列，按 0 处理`)
  }

  // 明细表可能缺失，出勤率按 0 处理
  const detail = parseDetailSheets(workbook, month, warnings)

  const records: AttendanceRecord[] = []
  const seenEmployeeKeys = new Set<string>()
  const missingDetailNames: string[] = []
  const groupedDepartments = new Map<string, number>()

  for (let i = summaryHeader.index + 1; i < summaryRows.length; i += 1) {
    const row = summaryRows[i] ?? []
    const rawName = cellText(row[columns.name])
    if (!rawName || rawName.includes('汇总') || rawName === '合计') continue

    const employeeKey = normalizeName(rawName)
    if (!employeeKey) continue
    if (seenEmployeeKeys.has(employeeKey)) {
      warnings.push(`「汇总」表中「${rawName}」出现多次，仅保留第一条`)
      continue
    }
    seenEmployeeKeys.add(employeeKey)

    const rawDepartment = cellText(row[columns.department])
    const departmentGroup = normalizeDepartment(rawDepartment)
    if (rawDepartment && departmentGroup !== rawDepartment) {
      groupedDepartments.set(rawDepartment, (groupedDepartments.get(rawDepartment) ?? 0) + 1)
    }

    const aggregate = detail.byName.get(employeeKey)
    if (!aggregate || aggregate.expected === 0) {
      missingDetailNames.push(rawName)
    }

    records.push({
      month: month ?? '',
      employee_key: employeeKey,
      employee_name: rawName,
      department: rawDepartment,
      department_group: departmentGroup,
      late_count: toNumber(row[columns.late]),
      severe_late_count: toNumber(row[columns.severeLate]),
      missing_punch_count: toNumber(row[columns.missingPunch]),
      proof_y: columns.proof >= 0 && cellText(row[columns.proof]).toUpperCase().startsWith('Y'),
      abnormal_days: toNumber(row[columns.abnormalDays]),
      overtime_hours: toNumber(row[columns.overtimeHours]),
      annual_leave: toNumber(row[columns.annualLeave]),
      comp_leave: toNumber(row[columns.compLeave]),
      sick_leave: toNumber(row[columns.sickLeave]),
      personal_leave: toNumber(row[columns.personalLeave]),
      bereavement_leave: toNumber(row[columns.bereavementLeave]),
      parental_leave: toNumber(row[columns.parentalLeave]),
      expected_days: aggregate?.expected ?? 0,
      attended_days: aggregate?.attended ?? 0,
    })
  }

  if (records.length === 0) {
    throw new Error('「汇总」表没有找到员工数据')
  }

  if (missingDetailNames.length > 0) {
    warnings.push(
      `${missingDetailNames.length} 名员工在明细表中无记录，出勤率留空：${missingDetailNames.slice(0, 8).join('、')}${
        missingDetailNames.length > 8 ? ' 等' : ''
      }`,
    )
  }

  const unmatchedDetailNames = [...detail.rawNames].filter((name) => !seenEmployeeKeys.has(normalizeName(name)))
  if (unmatchedDetailNames.length > 0) {
    warnings.push(`明细表中有 ${unmatchedDetailNames.length} 个姓名未匹配到汇总表：${unmatchedDetailNames.slice(0, 8).join('、')}`)
  }

  if (groupedDepartments.size > 0) {
    const summary = [...groupedDepartments].map(([name, count]) => `${name}→${normalizeDepartment(name)}（${count} 人）`)
    warnings.push(`部门已归组：${summary.join('；')}`)
  }

  const totals = emptyTotals()
  for (const record of records) {
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

  // 汇总表第 1 行是合计行，与表头隔一行日期标题；取 headerIndex - 2
  const declaredTotals: Partial<Record<keyof MonthlyTotals, number>> = {}
  const declaredRow = summaryRows[summaryHeader.index - 2]
  if (declaredRow) {
    const mapping: Array<[keyof MonthlyTotals, number]> = [
      ['late', columns.late],
      ['severeLate', columns.severeLate],
      ['missingPunch', columns.missingPunch],
      ['abnormalDays', columns.abnormalDays],
      ['overtimeHours', columns.overtimeHours],
      ['annualLeave', columns.annualLeave],
      ['compLeave', columns.compLeave],
      ['sickLeave', columns.sickLeave],
      ['personalLeave', columns.personalLeave],
      ['bereavementLeave', columns.bereavementLeave],
      ['parentalLeave', columns.parentalLeave],
    ]
    for (const [field, index] of mapping) {
      if (index >= 0) declaredTotals[field] = toNumber(declaredRow[index])
    }

    // 部分月份第 1 行 SUM 公式的范围会漏掉最后 1-2 行员工，这里以员工行合计为准并提示
    const checkLabels: Array<[keyof MonthlyTotals, string]> = [
      ['late', '迟到'],
      ['severeLate', '严重迟到'],
      ['missingPunch', '缺卡'],
      ['abnormalDays', '考勤异常（天）'],
      ['overtimeHours', '加班（小时）'],
      ['annualLeave', '年假（天）'],
      ['compLeave', '调休（天）'],
      ['sickLeave', '病假（天）'],
      ['personalLeave', '事假（天）'],
      ['bereavementLeave', '丧假'],
      ['parentalLeave', '育儿假'],
    ]
    for (const [field, labelText] of checkLabels) {
      const declared = declaredTotals[field]
      if (declared === undefined) continue
      if (Math.abs(declared - totals[field]) > 0.01) {
        warnings.push(
          `「汇总」表第 1 行「${labelText}」合计为 ${declared}，员工行合计为 ${totals[field]}（公式范围可能漏行），以员工行合计为准`,
        )
      }
    }
  }

  return {
    month,
    label,
    periodStart: detail.periodStart,
    periodEnd: detail.periodEnd,
    sourceFile: fileName,
    records,
    totals,
    declaredTotals,
    warnings,
  }
}
