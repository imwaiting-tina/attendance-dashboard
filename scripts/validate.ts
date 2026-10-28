/**
 * 本地校验脚本：解析指定文件夹内的全部月度考勤表，
 * 与「汇总」表第 1 行合计逐列比对，并打印出勤率。
 *
 * 用法：npm run validate -- /path/to/考勤汇总文件夹
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseAttendanceWorkbook } from '../src/lib/parseAttendance'
import type { MonthlyTotals } from '../src/lib/types'

const folder = process.argv[2]
if (!folder) {
  console.error('用法：npm run validate -- /path/to/考勤汇总文件夹')
  process.exit(1)
}

const files = fs
  .readdirSync(folder)
  .filter((name) => /\.(xlsx|xls)$/i.test(name) && !name.startsWith('~$'))
  .sort()

if (files.length === 0) {
  console.error(`目录中没有 Excel 文件：${folder}`)
  process.exit(1)
}

const comparisonFields: Array<[keyof MonthlyTotals, string]> = [
  ['late', '迟到'],
  ['severeLate', '严重迟到'],
  ['missingPunch', '缺卡'],
  ['abnormalDays', '考勤异常(天)'],
  ['overtimeHours', '加班(小时)'],
  ['annualLeave', '年假(天)'],
  ['compLeave', '调休(天)'],
  ['sickLeave', '病假(天)'],
  ['personalLeave', '事假(天)'],
  ['bereavementLeave', '丧假'],
  ['parentalLeave', '育儿假'],
]

let totalRecords = 0
let mismatchCount = 0

// 已确认是原表第 1 行 SUM 公式范围漏了最后员工行，不是解析问题
const KNOWN_DECLARED_TOTAL_ISSUES: Record<string, Array<keyof MonthlyTotals>> = {
  '2026-07': ['missingPunch'],
  '2026-08': ['missingPunch'],
}

console.log(`共 ${files.length} 个文件\n`)

for (const file of files) {
  const fullPath = path.join(folder, file)
  const buffer = fs.readFileSync(fullPath)
  const parsed = parseAttendanceWorkbook(new Uint8Array(buffer), file)
  totalRecords += parsed.records.length

  const rate = parsed.totals.expectedDays > 0
    ? (parsed.totals.attendedDays / parsed.totals.expectedDays) * 100
    : null

  console.log(`== ${parsed.month ?? '月份未识别'}  ${file}`)
  console.log(
    `   员工 ${parsed.records.length} 人 | 周期 ${parsed.periodStart ?? '-'} ~ ${parsed.periodEnd ?? '-'} | ` +
      `出勤 ${parsed.totals.attendedDays}/${parsed.totals.expectedDays} = ${rate === null ? '—' : rate.toFixed(1) + '%'}`,
  )
  console.log(
    `   迟到 ${parsed.totals.late} | 严重迟到 ${parsed.totals.severeLate} | 缺卡 ${parsed.totals.missingPunch} | ` +
      `补卡 ${parsed.totals.proofCount} 人 | 异常 ${parsed.totals.abnormalDays} 天 | 加班 ${parsed.totals.overtimeHours} h`,
  )
  console.log(
    `   年假 ${parsed.totals.annualLeave} | 调休 ${parsed.totals.compLeave} | 病假 ${parsed.totals.sickLeave} | ` +
      `事假 ${parsed.totals.personalLeave} | 丧假 ${parsed.totals.bereavementLeave} | 育儿假 ${parsed.totals.parentalLeave}`,
  )

  const mismatches: string[] = []
  let localUnknownMismatches = 0
  const knownIssues = parsed.month ? KNOWN_DECLARED_TOTAL_ISSUES[parsed.month] ?? [] : []
  for (const [field, label] of comparisonFields) {
    const declared = parsed.declaredTotals[field]
    if (declared === undefined) continue
    if (Math.abs(declared - parsed.totals[field]) > 0.01) {
      const suffix = knownIssues.includes(field) ? '（已知公式漏行）' : ''
      mismatches.push(`${label} 声明 ${declared} / 解析 ${parsed.totals[field]}${suffix}`)
      if (!knownIssues.includes(field)) localUnknownMismatches += 1
    }
  }
  mismatchCount += localUnknownMismatches
  console.log(
    mismatches.length === 0
      ? '   ✅ 与汇总表第 1 行合计一致'
      : `   ${localUnknownMismatches > 0 ? '❌' : '⚠️'} 合计差异：${mismatches.join('；')}`,
  )
  if (parsed.warnings.length > 0) {
    for (const warning of parsed.warnings) console.log(`   ⚠️ ${warning}`)
  }
  console.log('')
}

console.log(`合计员工记录 ${totalRecords} 条；合计比对不一致 ${mismatchCount} 项`)
if (mismatchCount > 0) process.exit(1)
