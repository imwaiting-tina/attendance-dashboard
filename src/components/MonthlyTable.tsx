import { Download } from 'lucide-react'
import type { MonthlyPoint } from '../lib/aggregate'
import { downloadCsv, safeFileName } from '../lib/csv'
import {
  formatMonthFull,
  formatNumber,
  rateToCsv,
} from '../lib/format'
import type { AttendancePeriod } from '../lib/types'
import { RateCell } from './RateCell'

interface MonthlyTableProps {
  points: MonthlyPoint[]
  periods: AttendancePeriod[]
  scopeLabel: string
}

function shortPeriodDate(value: string | null | undefined): string {
  if (!value) return ''
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return `${match[1]}.${match[2]}`
}

export function MonthlyTable({ points, periods, scopeLabel }: MonthlyTableProps) {
  const periodByMonth = new Map(periods.map((period) => [period.month, period]))

  const handleExport = () => {
    const headers = [
      '月份',
      '统计开始',
      '统计结束',
      '迟到',
      '严重迟到',
      '缺卡',
      '补卡人数',
      '考勤异常(天)',
      '加班(小时)',
      '年假(天)',
      '调休(天)',
      '病假(天)',
      '事假(天)',
      '丧假(天)',
      '育儿假(天)',
      '应出勤(天)',
      '实际出勤(天)',
      '出勤率(%)',
    ]
    const rows = points.map((point) => {
      const period = periodByMonth.get(point.month)
      return [
        point.month,
        period?.period_start ?? '',
        period?.period_end ?? '',
        point.late,
        point.severeLate,
        point.missingPunch,
        point.proofCount,
        point.abnormalDays,
        point.overtimeHours,
        point.annualLeave,
        point.compLeave,
        point.sickLeave,
        point.personalLeave,
        point.bereavementLeave,
        point.parentalLeave,
        point.expectedDays,
        point.attendedDays,
        rateToCsv(point.rate),
      ]
    })
    downloadCsv(`考勤月度汇总_${safeFileName(scopeLabel)}.csv`, headers, rows)
  }

  return (
    <section className="card table-card" id="monthly-table">
      <header className="card-head table-head">
        <div className="card-heading">
          <h2>月度汇总</h2>
          <p>
            {scopeLabel} · 共 {points.length} 个月
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleExport}
          disabled={points.length === 0}
        >
          <Download size={15} />
          导出 CSV
        </button>
      </header>

      <div className="table-scroll">
        <table className="data-table monthly-table">
          <caption className="sr-only">按月份汇总的考勤数据</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky-col">
                月份
              </th>
              <th scope="col">迟到</th>
              <th scope="col">严重迟到</th>
              <th scope="col">缺卡</th>
              <th scope="col">补卡人数</th>
              <th scope="col">考勤异常(天)</th>
              <th scope="col">加班(小时)</th>
              <th scope="col">年假(天)</th>
              <th scope="col">调休(天)</th>
              <th scope="col">病假(天)</th>
              <th scope="col">事假(天)</th>
              <th scope="col">丧假(天)</th>
              <th scope="col">育儿假(天)</th>
              <th scope="col">应出勤(天)</th>
              <th scope="col">实际出勤(天)</th>
              <th scope="col">出勤率</th>
            </tr>
          </thead>
          <tbody>
            {points.length === 0 ? (
              <tr>
                <td colSpan={16} className="table-empty">
                  当前筛选没有数据
                </td>
              </tr>
            ) : (
              points.map((point) => {
                const period = periodByMonth.get(point.month)
                return (
                  <tr key={point.month}>
                    <th scope="row" className="sticky-col month-cell">
                      <span className="month-main">{formatMonthFull(point.month)}</span>
                      {period ? (
                        <span className="month-period">
                          {shortPeriodDate(period.period_start)}–{shortPeriodDate(period.period_end)}
                        </span>
                      ) : null}
                    </th>
                    <td className="num">{formatNumber(point.late)}</td>
                    <td className="num">{formatNumber(point.severeLate)}</td>
                    <td className="num">{formatNumber(point.missingPunch)}</td>
                    <td className="num">{formatNumber(point.proofCount)}</td>
                    <td className="num">{formatNumber(point.abnormalDays)}</td>
                    <td className="num">{formatNumber(point.overtimeHours)}</td>
                    <td className="num">{formatNumber(point.annualLeave)}</td>
                    <td className="num">{formatNumber(point.compLeave)}</td>
                    <td className="num">{formatNumber(point.sickLeave)}</td>
                    <td className="num">{formatNumber(point.personalLeave)}</td>
                    <td className="num">{formatNumber(point.bereavementLeave)}</td>
                    <td className="num">{formatNumber(point.parentalLeave)}</td>
                    <td className="num">{formatNumber(point.expectedDays)}</td>
                    <td className="num">{formatNumber(point.attendedDays)}</td>
                    <td className="num">
                      <RateCell rate={point.rate} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="table-note">
        出勤率 = 实际打卡天数 ÷ 应出勤天数（仅按实际打卡）。补卡人数按 Y 员工每人每月计 1 人，
        不论当月缺卡几次。月度合计按原表考勤周期统计，周期起止见月份下方。
      </p>
    </section>
  )
}
