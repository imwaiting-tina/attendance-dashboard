const numberFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
})

/** 数字展示：整数不带小数，最多保留 1 位 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return numberFormatter.format(value)
}

/** 0.9643 → 96.4% */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

/** 出勤率原始小数差 → 百分点 */
export function formatRateDelta(delta: number | null): string {
  if (delta === null) return '—'
  const value = delta * 100
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(1)} 个百分点`
}

/** 计数差：+3 / −2 / ±0 */
export function formatCountDelta(delta: number | null): string {
  if (delta === null) return '—'
  const rounded = Math.round(delta * 10) / 10
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${formatNumber(Math.abs(rounded))}`
}

/** 2026-09 → 2026年9月 */
export function formatMonthFull(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month
  return `${match[1]}年${Number(match[2])}月`
}

/** 2026-09 → 26/09，用于横轴，避免标签过长 */
export function formatMonthAxis(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month
  return `${match[1].slice(2)}/${match[2]}`
}

/** 2026-09 → 2026.09，用于范围徽标 */
export function formatMonthCompact(month: string): string {
  return month.replace('-', '.')
}

/** 2026-09-01 → 2026.09.01 */
export function formatDateCompact(date: string | null | undefined): string {
  if (!date) return '—'
  return date.replaceAll('-', '.')
}

/** 入库时间：2026/10/28 14:30 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/** 横轴月份范围：2026.01 – 2026.09 */
export function formatMonthRange(months: string[]): string {
  if (months.length === 0) return '暂无数据'
  const sorted = [...months].sort()
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first === last) return formatMonthCompact(first)
  return `${formatMonthCompact(first)} – ${formatMonthCompact(last)}`
}

/** 百分比用于 CSV */
export function rateToCsv(rate: number | null): string {
  return rate === null ? '' : (rate * 100).toFixed(1)
}
