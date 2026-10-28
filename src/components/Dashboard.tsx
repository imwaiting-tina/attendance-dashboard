import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  UserRound,
} from 'lucide-react'
import {
  aggregateByMonth,
  countEmployees,
  filterByEmployeeSearch,
  listDepartments,
  summarizeEmployees,
} from '../lib/aggregate'
import {
  formatCountDelta,
  formatMonthFull,
  formatNumber,
  formatRate,
  formatRateDelta,
} from '../lib/format'
import { CHART_THEMES, type ThemeMode } from '../lib/theme'
import type { AttendancePeriod, AttendanceRecord } from '../lib/types'
import { AttendanceExceptions } from './AttendanceExceptions'
import { DataManagementDialog } from './DataManagementDialog'
import { EmployeeTable } from './EmployeeTable'
import { FilterBar, type EmployeeOption } from './FilterBar'
import { Header } from './Header'
import { KpiCard, type DeltaDirection, type DeltaTone } from './KpiCard'
import { MonthlyTable } from './MonthlyTable'
import {
  AttendanceRateCard,
  LateTrendCard,
  LeaveTrendCard,
  MissingPunchCard,
  OvertimeCard,
} from './charts/TrendCharts'

// SheetJS 只在校验/导入时需要，按需加载，避免拖慢首屏
const ImportDialog = lazy(() =>
  import('./ImportDialog').then((module) => ({ default: module.ImportDialog })),
)

interface DashboardProps {
  account: string
  records: AttendanceRecord[]
  periods: AttendancePeriod[]
  loading: boolean
  refreshing: boolean
  error: string | null
  mode: ThemeMode
  onToggleTheme: () => void
  onSignOut: () => void
  reload: () => Promise<void>
}

interface KpiDelta {
  deltaText: string
  deltaTone: DeltaTone
  deltaDirection: DeltaDirection
}

type DeltaPolicy = 'lower-better' | 'higher-better' | 'neutral'

function buildCountDelta(current: number, previous: number | undefined, policy: DeltaPolicy): KpiDelta {
  if (previous === undefined) {
    return { deltaText: '暂无上期数据', deltaTone: 'neutral', deltaDirection: 'flat' }
  }
  const difference = current - previous
  const direction: DeltaDirection = difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat'
  let tone: DeltaTone = 'neutral'
  if (difference !== 0 && policy !== 'neutral') {
    const better = policy === 'lower-better' ? difference < 0 : difference > 0
    tone = better ? 'good' : 'bad'
  }
  return {
    deltaText: `较上期 ${formatCountDelta(difference)}`,
    deltaTone: tone,
    deltaDirection: direction,
  }
}

function buildRateDelta(current: number | null, previous: number | null | undefined): KpiDelta {
  if (current === null || previous === null || previous === undefined) {
    return { deltaText: '暂无上期出勤数据', deltaTone: 'neutral', deltaDirection: 'flat' }
  }
  const difference = current - previous
  const direction: DeltaDirection = difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat'
  return {
    deltaText: `较上期 ${formatRateDelta(difference)}`,
    deltaTone: difference === 0 ? 'neutral' : difference > 0 ? 'good' : 'bad',
    deltaDirection: direction,
  }
}

function shortenPeriodDate(value: string | null | undefined): string {
  if (!value) return ''
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return `${match[1]}.${match[2]}`
}

export function Dashboard({
  account,
  records,
  periods,
  loading,
  refreshing,
  error,
  mode,
  onToggleTheme,
  onSignOut,
  reload,
}: DashboardProps) {
  // null = 全部月份；数组 = 用户选中的月份，1 个为单月查看，2 个及以上为月份对比
  const [selectedMonths, setSelectedMonths] = useState<string[] | null>(null)
  const [department, setDepartment] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const toastIdRef = useRef(0)

  const theme = CHART_THEMES[mode]
  const availableMonths = useMemo(
    () => periods.map((period) => period.month).sort((a, b) => a.localeCompare(b)),
    [periods],
  )
  const selectedMonthSet = useMemo(
    () => (selectedMonths ? new Set(selectedMonths) : null),
    [selectedMonths],
  )
  // 月份筛选只影响可选的部门/员工与当前展示范围，不改变已导入的月份列表
  const monthRecords = useMemo(
    () =>
      selectedMonthSet
        ? records.filter((record) => selectedMonthSet.has(record.month))
        : records,
    [records, selectedMonthSet],
  )
  const departments = useMemo(() => listDepartments(monthRecords), [monthRecords])
  const allEmployees = useMemo(() => summarizeEmployees(monthRecords), [monthRecords])
  const employeeByKey = useMemo(
    () => new Map(allEmployees.map((employee) => [employee.employee_key, employee])),
    [allEmployees],
  )
  const employeeOptions = useMemo<EmployeeOption[]>(
    () =>
      [...allEmployees]
        .sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'zh-Hans-CN'))
        .map((employee) => ({
          key: employee.employee_key,
          name: employee.employee_name,
          department: employee.department_group,
        })),
    [allEmployees],
  )

  const selectedEmployee = selectedKey ? employeeByKey.get(selectedKey) : undefined

  // 不含月份筛选的基础范围，用于单月对比上一自然月、近 3 个月月均等跨月计算
  const baseScopeRecords = useMemo(() => {
    if (selectedKey) return records.filter((record) => record.employee_key === selectedKey)
    const departmentRecords =
      department === 'all'
        ? records
        : records.filter((record) => record.department_group === department)
    return filterByEmployeeSearch(departmentRecords, search)
  }, [records, department, search, selectedKey])

  const monthMode: 'all' | 'single' | 'compare' =
    selectedMonths === null ? 'all' : selectedMonths.length === 1 ? 'single' : 'compare'
  const singleMonth = monthMode === 'single' ? (selectedMonths?.[0] ?? null) : null

  const scopeRecords = useMemo(
    () =>
      selectedMonthSet
        ? baseScopeRecords.filter((record) => selectedMonthSet.has(record.month))
        : baseScopeRecords,
    [baseScopeRecords, selectedMonthSet],
  )

  const points = useMemo(() => aggregateByMonth(scopeRecords), [scopeRecords])
  const comparisonPoints = useMemo(() => aggregateByMonth(baseScopeRecords), [baseScopeRecords])
  const employeeSummaries = useMemo(() => summarizeEmployees(scopeRecords), [scopeRecords])
  const latest = points[points.length - 1]
  // 单月查看与上一自然月比较；多选对比与前一所选月份比较
  const previous = useMemo(() => {
    if (!latest) return undefined
    if (monthMode === 'single') {
      const index = comparisonPoints.findIndex((point) => point.month === latest.month)
      return index > 0 ? comparisonPoints[index - 1] : undefined
    }
    return points.length > 1 ? points[points.length - 2] : undefined
  }, [comparisonPoints, latest, monthMode, points])
  const latestPeriod = latest ? periods.find((period) => period.month === latest.month) : undefined
  const latestPeriodDetail =
    latestPeriod?.period_start && latestPeriod?.period_end
      ? `${shortenPeriodDate(latestPeriod.period_start)}–${shortenPeriodDate(latestPeriod.period_end)}`
      : null

  const departmentLabel = department === 'all' ? '全公司' : department
  const searchTerm = search.trim()
  const monthLabel = singleMonth ? formatMonthFull(singleMonth) : null
  const selectedMonthNames = points.map((point) => formatMonthFull(point.month))
  const scopeLabel = selectedEmployee
    ? selectedEmployee.employee_name
    : `${departmentLabel}${searchTerm ? ` · 姓名含“${searchTerm}”` : ''}`
  const monthScopeLabel =
    monthMode === 'all'
      ? `${points.length} 个月`
      : monthMode === 'single'
        ? `${monthLabel} · 单月查看`
        : points.length === 2
          ? `${selectedMonthNames.join('、')} 对比`
          : `${points.length} 个月对比`
  const scopeSummary = `${scopeLabel} · ${monthScopeLabel} · ${scopeRecords.length} 条记录`
  // 月度表/CSV 文件名带上所选月份，避免不同月份导出同名文件
  const tableScopeLabel =
    monthMode === 'all'
      ? scopeLabel
      : monthMode === 'single'
        ? `${scopeLabel} · ${monthLabel}`
        : points.length <= 2
          ? `${scopeLabel} · ${selectedMonthNames.join('、')}`
          : `${scopeLabel} · 所选 ${points.length} 个月`
  const filterActive =
    selectedMonths !== null || department !== 'all' || searchTerm.length > 0 || Boolean(selectedKey)

  const existingMonths = useMemo(() => new Set(periods.map((period) => period.month)), [periods])

  useEffect(() => {
    if (selectedKey && !monthRecords.some((record) => record.employee_key === selectedKey)) {
      setSelectedKey(null)
      setSearch('')
    }
  }, [monthRecords, selectedKey])

  useEffect(() => {
    if (!selectedMonths) return
    const available = new Set(periods.map((period) => period.month))
    const next = selectedMonths.filter((month) => available.has(month))
    if (next.length !== selectedMonths.length) {
      setSelectedMonths(next.length > 0 ? next : null)
    }
  }, [periods, selectedMonths])

  useEffect(() => {
    if (department !== 'all' && !departments.includes(department)) setDepartment('all')
  }, [departments, department])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showToast = (message: string) => {
    toastIdRef.current += 1
    setToast({ id: toastIdRef.current, message })
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    const trimmed = value.trim()
    if (!trimmed) {
      if (selectedKey) setSelectedKey(null)
      return
    }
    const exact = allEmployees.find(
      (employee) => employee.employee_name === trimmed || employee.employee_key === trimmed,
    )
    if (exact) {
      setSelectedKey(exact.employee_key)
      setSearch(exact.employee_name)
    } else if (selectedKey) {
      setSelectedKey(null)
    }
  }

  const selectEmployee = (employeeKey: string) => {
    const employee = employeeByKey.get(employeeKey)
    if (!employee) return
    setSelectedKey(employee.employee_key)
    setSearch(employee.employee_name)
    window.setTimeout(() => {
      document.getElementById('trends')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    }, 0)
  }

  const exitPersonalView = () => {
    setSelectedKey(null)
    setSearch('')
  }

  const resetFilters = () => {
    setSelectedMonths(null)
    setDepartment('all')
    setSearch('')
    setSelectedKey(null)
  }

  const handleSelectAllMonths = () => {
    setSelectedMonths(null)
  }

  const handleToggleMonth = (value: string) => {
    setSelectedMonths((current) => {
      // 从「全部月份」点某个 chip 时，先窄化为该月；再点其他月份即形成对比
      if (current === null) return [value]
      const next = current.includes(value)
        ? current.filter((month) => month !== value)
        : [...current, value].sort((a, b) => a.localeCompare(b))
      // 取消到空，或恰好选满全部月份时，回到「全部月份」
      if (next.length === 0 || next.length === availableMonths.length) return null
      return next
    })
  }

  const handleImported = async () => {
    await reload()
    showToast('考勤数据已更新')
  }

  const handleDeleted = async () => {
    await reload()
    showToast('数据已删除')
  }

  // 单月/全部视图下，近 3 个月月均取截止到最新月的最近三个月；多选对比时按所选月份计算
  const latestIndex = latest
    ? comparisonPoints.findIndex((point) => point.month === latest.month)
    : -1
  const recentPoints =
    latestIndex >= 0 ? comparisonPoints.slice(Math.max(0, latestIndex - 2), latestIndex + 1) : []
  const overtimeAveragePoints = monthMode === 'compare' ? points.slice(-3) : recentPoints
  const recentOvertime =
    overtimeAveragePoints.length > 0
      ? overtimeAveragePoints.reduce((sum, point) => sum + point.overtimeHours, 0) /
        overtimeAveragePoints.length
      : 0
  const overtimeAverageLabel = monthMode === 'compare' ? '所选月份月均' : '近 3 个月月均'

  const lateTotal = latest ? latest.late + latest.severeLate : 0
  const previousLateTotal = previous ? previous.late + previous.severeLate : undefined

  const kpiCards = latest ? (
    <>
      <KpiCard
        label="迟到次数"
        value={formatNumber(lateTotal)}
        unit="次"
        sub={`迟到 ${formatNumber(latest.late)} · 严重迟到 ${formatNumber(latest.severeLate)}`}
        {...buildCountDelta(lateTotal, previousLateTotal, 'lower-better')}
      />
      <KpiCard
        label="缺卡次数"
        value={formatNumber(latest.missingPunch)}
        unit="次"
        sub={`补卡 ${formatNumber(latest.proofCount)} 人 · 考勤异常 ${formatNumber(latest.abnormalDays)} 天`}
        {...buildCountDelta(latest.missingPunch, previous?.missingPunch, 'lower-better')}
      />
      <KpiCard
        label="加班时长"
        value={formatNumber(latest.overtimeHours)}
        unit="h"
        sub={`${overtimeAverageLabel} ${formatNumber(recentOvertime)} h`}
        {...buildCountDelta(latest.overtimeHours, previous?.overtimeHours, 'neutral')}
      />
      <KpiCard
        label="出勤率"
        value={formatRate(latest.rate)}
        sub={`实际打卡 ${formatNumber(latest.attendedDays)} / 应出勤 ${formatNumber(latest.expectedDays)} 天`}
        {...buildRateDelta(latest.rate, previous?.rate)}
      />
      <KpiCard
        label={monthMode === 'all' ? '覆盖月份' : '所选月份'}
        value={String(points.length)}
        unit="个月"
        sub={`${countEmployees(scopeRecords)} 名员工 · ${scopeRecords.length} 条记录`}
        deltaText={
          monthMode === 'all'
            ? `最新 ${formatMonthFull(latest.month)}`
            : monthMode === 'single'
              ? `查看 ${formatMonthFull(latest.month)}`
              : `已选 ${points.length} 个月`
        }
        deltaTone="neutral"
        deltaDirection="flat"
      />
    </>
  ) : null

  return (
    <div className="app-shell">
      <Header
        account={account}
        periods={periods}
        mode={mode}
        onToggleTheme={onToggleTheme}
        onOpenImport={() => setImportOpen(true)}
        onOpenManage={() => setManageOpen(true)}
        onSignOut={onSignOut}
      />

      <main className="app-main">
        {loading && records.length === 0 ? (
          <section className="card state-card" role="status">
            <Loader2 size={28} className="spin" />
            <h2>正在加载考勤数据</h2>
            <p>正在从 Supabase 读取已导入的月份…</p>
          </section>
        ) : error && records.length === 0 ? (
          <section className="card state-card">
            <CircleAlert size={28} />
            <h2>无法读取考勤数据</h2>
            <p>{error}</p>
            <p className="state-hint">请确认 Supabase 迁移已执行，并且当前账号已在管理员名单中。</p>
            <button type="button" className="btn btn-primary" onClick={() => void reload()}>
              <RefreshCw size={16} />
              重试
            </button>
          </section>
        ) : records.length === 0 ? (
          <section className="card state-card">
            <FileSpreadsheet size={36} />
            <h2>还没有考勤数据</h2>
            <p>先导入历史月份的考勤表，导入完成后仪表盘会自动生成。</p>
            <button type="button" className="btn btn-primary" onClick={() => setImportOpen(true)}>
              <Upload size={16} />
              导入考勤表
            </button>
          </section>
        ) : (
          <>
            {error ? (
              <div className="alert alert-error dashboard-alert" role="alert">
                <CircleAlert size={16} />
                <span>数据刷新失败：{error}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void reload()}>
                  重试
                </button>
              </div>
            ) : null}

            <div className={`dashboard-content ${refreshing ? 'is-refreshing' : ''}`}>
              <FilterBar
                months={availableMonths}
                selectedMonths={selectedMonths}
                onSelectAllMonths={handleSelectAllMonths}
                onToggleMonth={handleToggleMonth}
                departments={departments}
                department={department}
                onDepartmentChange={setDepartment}
                search={search}
                onSearchChange={handleSearchChange}
                onSelectEmployee={selectEmployee}
                employeeOptions={employeeOptions}
                personalMode={Boolean(selectedEmployee)}
                summary={scopeSummary}
                filterActive={filterActive}
                onReset={resetFilters}
              />

              {selectedEmployee ? (
                <div className="personal-banner">
                  <span className="personal-icon" aria-hidden="true">
                    <UserRound size={17} />
                  </span>
                  <div className="personal-text">
                    <strong>{selectedEmployee.employee_name}</strong>
                    <span>
                      个人视图 · {points.length} 个月有记录
                      {selectedEmployee.department_group ? ` · 最近部门 ${selectedEmployee.department_group}` : ''}
                    </span>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={exitPersonalView}>
                    返回团队视图
                  </button>
                </div>
              ) : null}

              {points.length === 0 ? (
                <section className="card state-card state-card-compact">
                  <Search size={26} />
                  <h2>当前筛选没有数据</h2>
                  <p>换一个月份、部门或姓名关键词，或清除筛选查看全部记录。</p>
                  <button type="button" className="btn btn-secondary" onClick={resetFilters}>
                    清除筛选
                  </button>
                </section>
              ) : (
                <>
                  <section className="kpi-section" aria-labelledby="kpi-title">
                    <div className="section-head">
                      <div>
                        <h2 id="kpi-title">关键指标</h2>
                        <p>
                          {monthMode === 'all'
                            ? '最新月份'
                            : monthMode === 'single'
                              ? '查看月份'
                              : `对比 ${points.length} 个月 · 最新`}{' '}
                          {latest ? formatMonthFull(latest.month) : '—'}
                          {latestPeriodDetail ? ` · ${latestPeriodDetail}` : ''} ·{' '}
                          {monthMode === 'single'
                            ? '与上一自然月对比'
                            : monthMode === 'compare'
                              ? '与前一所选月份对比'
                              : '与上一月对比'}
                        </p>
                      </div>
                    </div>
                    <div className="kpi-grid">{kpiCards}</div>
                  </section>

                  <section className="trends-section" id="trends" aria-labelledby="trends-title">
                    <div className="section-head">
                      <div>
                        <h2 id="trends-title">月度趋势</h2>
                        <p>
                          {selectedEmployee
                            ? `${selectedEmployee.employee_name} 的个人${
                                monthMode === 'all'
                                  ? '逐月'
                                  : monthMode === 'single'
                                    ? '单月'
                                    : '所选月份'
                              }数据`
                            : monthMode === 'all'
                              ? `${scopeLabel} · 所有图表共用当前筛选`
                              : monthMode === 'single'
                                ? `${scopeLabel} · 单月查看，图表仅显示该月`
                                : `${scopeLabel} · 已选 ${points.length} 个月对比，图表仅显示所选月份`}
                        </p>
                      </div>
                    </div>
                    <div className="chart-grid">
                      <LateTrendCard points={points} theme={theme} />
                      <MissingPunchCard points={points} theme={theme} />
                      <LeaveTrendCard points={points} theme={theme} />
                      <OvertimeCard points={points} theme={theme} />
                      <AttendanceRateCard points={points} theme={theme} />
                    </div>
                  </section>

                  <MonthlyTable points={points} periods={periods} scopeLabel={tableScopeLabel} />

                  <AttendanceExceptions records={scopeRecords} onSelect={selectEmployee} />

                  {selectedEmployee ? null : (
                    <EmployeeTable employees={employeeSummaries} onSelect={selectEmployee} />
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        <span>数据来源：月度考勤汇总表</span>
        <span className="footer-dot" aria-hidden="true" />
        <span>仅管理员可见 · 支持从页面继续导入新月份</span>
      </footer>

      {importOpen ? (
        <Suspense
          fallback={
            <div className="modal-fallback" role="status">
              <Loader2 size={22} className="spin" />
              正在准备导入…
            </div>
          }
        >
          <ImportDialog
            open
            onClose={() => setImportOpen(false)}
            existingMonths={existingMonths}
            onImported={handleImported}
          />
        </Suspense>
      ) : null}
      <DataManagementDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        periods={periods}
        onDeleted={handleDeleted}
      />

      {toast ? (
        <div className="toast" role="status" key={toast.id}>
          <CheckCircle2 size={16} />
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  )
}
