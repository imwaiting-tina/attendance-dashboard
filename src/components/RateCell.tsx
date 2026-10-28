import { formatRate } from '../lib/format'

/** 表格里的出勤率数字 + 细进度条，进度条只做辅助 */
export function RateCell({ rate }: { rate: number | null }) {
  const width = rate === null ? 0 : Math.max(0, Math.min(100, rate * 100))

  return (
    <span className="rate-cell">
      <span className="rate-number">{formatRate(rate)}</span>
      <span className="rate-track" aria-hidden="true">
        <span className="rate-fill" style={{ width: `${width}%` }} />
      </span>
    </span>
  )
}
