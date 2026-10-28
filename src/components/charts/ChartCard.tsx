import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  subtitle: string
  unit?: string
  className?: string
  children: ReactNode
}

/** 所有趋势图共用的卡片外壳与数据表入口 */
export function ChartCard({ title, subtitle, unit, className = '', children }: ChartCardProps) {
  return (
    <section className={`card chart-card ${className}`.trim()}>
      <header className="card-head">
        <div className="card-heading">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {unit ? <span className="unit-badge">{unit}</span> : null}
      </header>
      <div className="chart-body">{children}</div>
      <a className="chart-table-link" href="#monthly-table">
        查看数据表
      </a>
    </section>
  )
}
