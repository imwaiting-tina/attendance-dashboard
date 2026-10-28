import { Converter } from 'opencc-js'

/** 繁体（香港）转简体，用于跨月姓名/文本归一化 */
const toSimplified = Converter({ from: 'hk', to: 'cn' })

/** 明细表里出现过的英文名/别名，统一指向汇总表姓名 */
const NAME_ALIASES: Record<string, string> = {
  'yvonne lai': '赖淑贤',
}

/** 姓名归一化：英文别名 → 繁转简 → 去空白 */
export function normalizeName(raw: string): string {
  const trimmed = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  const alias = NAME_ALIASES[trimmed.toLowerCase()]
  if (alias) return normalizeName(alias)
  return toSimplified(trimmed).replace(/\s+/g, '').trim()
}

/** 部门跨月改名/拆分归组，保证筛选口径稳定 */
const DEPARTMENT_GROUPS: Record<string, string> = {
  香港财务部: '香港办',
  香港办: '香港办',
  账务部: '账务部',
  账务部1: '账务部',
  账务部2: '账务部',
  行政保洁部: '行政部-保洁',
  '行政部-保洁': '行政部-保洁',
}

export function normalizeDepartment(raw: string): string {
  const name = String(raw ?? '').trim()
  return DEPARTMENT_GROUPS[name] ?? name
}

/** 把 26-09-01 或 2026-09-01 转成 ISO 日期（20xx 年） */
export function parseShortDate(value: unknown): string | null {
  const text = String(value ?? '').trim()
  const match = /^(\d{2}|\d{4})-(\d{1,2})-(\d{1,2})/.exec(text)
  if (!match) return null
  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 从文件名识别月份，如 202608考勤表v2(1).xlsx → 2026-08 */
export function detectMonthFromFileName(fileName: string): string | null {
  const base = fileName.replace(/^.*[\\/]/, '')
  const match = /(20\d{2})(0[1-9]|1[0-2])/.exec(base)
  if (!match) return null
  return `${match[1]}-${match[2]}`
}

/** 2026-10 → 2026年10月 */
export function formatMonthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month
  return `${match[1]}年${Number(match[2])}月`
}
