import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

export type DeltaTone = 'good' | 'bad' | 'neutral'
export type DeltaDirection = 'up' | 'down' | 'flat'

interface KpiCardProps {
  label: string
  value: string
  unit?: string
  sub: string
  deltaText?: string
  deltaTone?: DeltaTone
  deltaDirection?: DeltaDirection
}

const DIRECTION_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

export function KpiCard({
  label,
  value,
  unit,
  sub,
  deltaText,
  deltaTone = 'neutral',
  deltaDirection = 'flat',
}: KpiCardProps) {
  const DeltaIcon = DIRECTION_ICONS[deltaDirection]

  return (
    <div className="card kpi-card">
      <p className="kpi-label">{label}</p>
      <div className="kpi-value-row">
        <span className="kpi-value">{value}</span>
        {unit ? <span className="kpi-unit">{unit}</span> : null}
      </div>
      <p className="kpi-sub">{sub}</p>
      <div className={`kpi-delta kpi-delta-${deltaTone}`}>
        <DeltaIcon size={14} strokeWidth={2} aria-hidden="true" />
        <span>{deltaText ?? '暂无对比数据'}</span>
      </div>
    </div>
  )
}
