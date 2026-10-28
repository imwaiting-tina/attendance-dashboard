import { useMemo } from 'react'
import type { MonthlyPoint } from '../../lib/aggregate'
import {
  buildAbnormalDaysOption,
  buildAttendanceRateOption,
  buildLateTrendOption,
  buildLeaveTrendOption,
  buildMissingPunchOption,
  buildOvertimeOption,
} from '../../lib/chartOptions'
import type { ChartTheme } from '../../lib/theme'
import { Chart, ChartEmpty } from './Chart'
import { ChartCard } from './ChartCard'

interface TrendProps {
  points: MonthlyPoint[]
  theme: ChartTheme
}

export function LateTrendCard({ points, theme }: TrendProps) {
  const option = useMemo(() => buildLateTrendOption(points, theme), [points, theme])
  const empty = points.length === 0 || points.every((point) => point.late + point.severeLate === 0)

  return (
    <ChartCard title="迟到次数趋势" subtitle="迟到与严重迟到按月合计" unit="次">
      {empty ? (
        <ChartEmpty height={290} message="当前范围内没有迟到记录" />
      ) : (
        <Chart option={option} height={290} ariaLabel="迟到次数趋势图，按月展示迟到与严重迟到次数" />
      )}
    </ChartCard>
  )
}

export function MissingPunchCard({ points, theme }: TrendProps) {
  const mainOption = useMemo(() => buildMissingPunchOption(points, theme), [points, theme])
  const abnormalOption = useMemo(() => buildAbnormalDaysOption(points, theme), [points, theme])
  const mainEmpty =
    points.length === 0 || points.every((point) => point.missingPunch === 0 && point.proofCount === 0)
  const abnormalEmpty = points.length === 0 || points.every((point) => point.abnormalDays === 0)

  return (
    <ChartCard
      title="缺卡趋势"
      subtitle="缺卡次数与补卡人数（上）；考勤异常天数（下）"
      unit="次 / 人 / 天"
    >
      <div className="subchart-head">
        <span>缺卡次数与补卡人数</span>
        <span className="subchart-note">次 / 人</span>
      </div>
      {mainEmpty ? (
        <ChartEmpty height={140} message="当前范围内没有缺卡记录" />
      ) : (
        <Chart
          option={mainOption}
          height={140}
          ariaLabel="缺卡趋势图上半部分，展示缺卡次数与补卡人数"
        />
      )}
      <div className="subchart-head subchart-head-second">
        <span>考勤异常天数</span>
        <span className="subchart-note">天</span>
      </div>
      {abnormalEmpty ? (
        <ChartEmpty height={88} message="当前范围内没有考勤异常记录" />
      ) : (
        <Chart
          option={abnormalOption}
          height={88}
          ariaLabel="缺卡趋势图下半部分，展示考勤异常天数"
        />
      )}
    </ChartCard>
  )
}

export function LeaveTrendCard({ points, theme }: TrendProps) {
  const option = useMemo(() => buildLeaveTrendOption(points, theme), [points, theme])
  const empty =
    points.length === 0 ||
    points.every(
      (point) =>
        point.annualLeave +
          point.compLeave +
          point.sickLeave +
          point.personalLeave +
          point.bereavementLeave +
          point.parentalLeave ===
        0,
    )

  return (
    <ChartCard
      title="假期分类趋势"
      subtitle="年假、调休、病假、事假、丧假、育儿假"
      unit="天"
    >
      {empty ? (
        <ChartEmpty height={290} message="当前范围内没有请假记录" />
      ) : (
        <Chart option={option} height={290} ariaLabel="假期分类趋势图，按假期种类堆叠展示天数" />
      )}
    </ChartCard>
  )
}

export function OvertimeCard({ points, theme }: TrendProps) {
  const option = useMemo(() => buildOvertimeOption(points, theme), [points, theme])
  const empty = points.length === 0 || points.every((point) => point.overtimeHours === 0)
  const showAverage = points.length >= 3

  return (
    <ChartCard
      title="加班趋势"
      subtitle={showAverage ? '月度加班时长与 3 个月移动平均' : '单月查看不计算移动平均'}
      unit="小时"
    >
      {empty ? (
        <ChartEmpty height={290} message="当前范围内没有加班记录" />
      ) : (
        <Chart
          option={option}
          height={290}
          ariaLabel={
            showAverage
              ? '加班趋势图，展示月度加班时长与三个月移动平均'
              : '加班趋势图，展示所选月份的加班时长'
          }
        />
      )}
    </ChartCard>
  )
}

export function AttendanceRateCard({ points, theme }: TrendProps) {
  const option = useMemo(() => buildAttendanceRateOption(points, theme), [points, theme])
  const empty = points.length === 0 || points.every((point) => point.rate === null)

  return (
    <ChartCard
      title="出勤率趋势"
      subtitle="实际打卡天数 ÷ 应出勤天数；纵轴按数据范围缩放"
      unit="%"
      className="chart-span-2"
    >
      {empty ? (
        <ChartEmpty height={270} message="当前范围内没有可用的出勤数据" />
      ) : (
        <Chart option={option} height={270} ariaLabel="出勤率趋势图，按月度展示实际打卡天数占应出勤天数的比例" />
      )}
    </ChartCard>
  )
}
