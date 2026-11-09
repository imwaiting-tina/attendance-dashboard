import { useMemo, useState } from 'react'
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'
import type { DepartmentSummary, SortOrder } from '../../lib/aggregate'
import {
  buildDepartmentLateOption,
  buildDepartmentLeaveOption,
  buildDepartmentMissingOption,
} from '../../lib/chartOptions'
import type { ChartTheme } from '../../lib/theme'
import { Chart, ChartEmpty } from './Chart'
import { ChartCard } from './ChartCard'

interface DepartmentComparisonProps {
  departments: DepartmentSummary[]
  theme: ChartTheme
  /** 例如「2026年10月」或「所选 3 个月累计」 */
  scopeLabel: string
  onSelectDepartment: (department: string) => void
}

function chartHeight(departmentCount: number): number {
  // 每个部门一行，给部门名称和柱条留出足够高度
  return Math.max(260, departmentCount * 28 + 58)
}

/** 三个独立的部门横向对比图，共用一个排序方向 */
export function DepartmentComparison({
  departments,
  theme,
  scopeLabel,
  onSelectDepartment,
}: DepartmentComparisonProps) {
  const [order, setOrder] = useState<SortOrder>('desc')

  // 零值部门不参与排序，避免单月视图出现整列空白行
  const lateDepartments = useMemo(
    () => departments.filter((item) => item.lateTotal > 0),
    [departments],
  )
  const missingDepartments = useMemo(
    () => departments.filter((item) => item.missingPunch > 0),
    [departments],
  )
  const leaveDepartments = useMemo(
    () => departments.filter((item) => item.leaveTotal > 0),
    [departments],
  )

  const lateOption = useMemo(
    () => buildDepartmentLateOption(lateDepartments, order, theme),
    [lateDepartments, order, theme],
  )
  const missingOption = useMemo(
    () => buildDepartmentMissingOption(missingDepartments, order, theme),
    [missingDepartments, order, theme],
  )
  const leaveOption = useMemo(
    () => buildDepartmentLeaveOption(leaveDepartments, order, theme),
    [leaveDepartments, order, theme],
  )

  const height = chartHeight(
    Math.max(lateDepartments.length, missingDepartments.length, leaveDepartments.length),
  )

  return (
    <section
      className="department-section"
      id="department-comparison"
      aria-labelledby="department-comparison-title"
    >
      <div className="section-head department-section-head">
        <div>
          <h2 id="department-comparison-title">部门对比</h2>
          <p>{scopeLabel} · 全公司口径 · 点击柱条筛选并定位到该部门人员明细</p>
        </div>
        <div className="sort-toggle" role="group" aria-label="部门对比排序方式">
          <span className="sort-toggle-label">排序</span>
          <button
            type="button"
            className="sort-button"
            aria-pressed={order === 'desc'}
            onClick={() => setOrder('desc')}
          >
            <ArrowDownWideNarrow size={14} aria-hidden="true" />
            从高到低
          </button>
          <button
            type="button"
            className="sort-button"
            aria-pressed={order === 'asc'}
            onClick={() => setOrder('asc')}
          >
            <ArrowUpNarrowWide size={14} aria-hidden="true" />
            从低到高
          </button>
        </div>
      </div>

      <div className="chart-grid department-chart-grid">
        <ChartCard
          title="部门迟到对比"
          subtitle="迟到与严重迟到合计；仅显示有记录部门，点击柱条查看人员"
          unit="次"
          className="department-chart-card"
          tableHref="#employees"
          tableLabel="查看部门人员"
        >
          {lateDepartments.length === 0 ? (
            <ChartEmpty height={height} message="所选范围内没有迟到记录" />
          ) : (
            <Chart
              option={lateOption}
              height={height}
              ariaLabel="部门迟到对比图，横向展示各部门迟到与严重迟到合计"
              onClick={onSelectDepartment}
            />
          )}
        </ChartCard>

        <ChartCard
          title="部门缺卡对比"
          subtitle="按缺卡次数排序；仅显示有记录部门，点击柱条查看人员"
          unit="次"
          className="department-chart-card"
          tableHref="#employees"
          tableLabel="查看部门人员"
        >
          {missingDepartments.length === 0 ? (
            <ChartEmpty height={height} message="所选范围内没有缺卡记录" />
          ) : (
            <Chart
              option={missingOption}
              height={height}
              ariaLabel="部门缺卡对比图，横向展示各部门缺卡次数"
              onClick={onSelectDepartment}
            />
          )}
        </ChartCard>

        <ChartCard
          title="部门请假对比"
          subtitle="六类请假合计；仅显示有记录部门，点击柱条查看人员"
          unit="天"
          className="department-chart-card"
          tableHref="#employees"
          tableLabel="查看部门人员"
        >
          {leaveDepartments.length === 0 ? (
            <ChartEmpty height={height} message="所选范围内没有请假记录" />
          ) : (
            <Chart
              option={leaveOption}
              height={height}
              ariaLabel="部门请假对比图，横向展示各部门请假合计天数"
              onClick={onSelectDepartment}
            />
          )}
        </ChartCard>
      </div>
    </section>
  )
}
