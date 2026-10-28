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
  email: string
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
  email,
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
  const [department, setDepartment] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const toastIdRef = useRef(0)

  const theme = CHART_THEMES[mode]
  const departments = useMemo(() => listDepartments(records), [records])
  const allEmployees = useMemo(() => summarizeEmployees(records), [records])
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

  const scopeRecords = useMemo(() => {
    if (selectedKey) return records.filter((record) => record.employee_key === selectedKey)
    const departmentRecords =
      department === 'all'
        ? records
        : records.filter((record) => record.department_group === department)
    return filterByEmployeeSearch(departmentRecords, search)
  }, [records, department, search, selectedKey])

  const points = useMemo(() => aggregateByMonth(scopeRecords), [scopeRecords])
  const employeeSummaries = useMemo(() => summarizeEmployees(scopeRecords), [scopeRecords])
  const latest = points[points.length - 1]
  const previous = points[points.length - 2]
  const latestPeriod = latest ? periods.find((period) => period.month === latest.month) : undefined
  const latestPeriodDetail =
    latestPeriod?.period_start && latestPeriod?.period_end
      ? `${shortenPeriodDate(latestPeriod.period_start)}–${shortenPeriodDate(latestPeriod.period_end)}`
      : null

  const departmentLabel = department === 'all' ? '全公司' : department
  const searchTerm = search.trim()
  const scopeLabel = selectedEmployee
    ? selectedEmployee.employee_name
    : `${departmentLabel}${searchTerm ? ` · 姓名含“${searchTerm}”` : ''}`
  const filterActive = department !== 'all' || searchTerm.length > 0 || Boolean(selectedKey)

  const existingMonths = useMemo(() => new Set(periods.map((period) => period.month)), [periods])

  useEffect(() => {
    if (selectedKey && !records.some((record) => record.employee_key === selectedKey)) {
      setSelectedKey(null)
      setSearch('')
    }
  }, [records, selectedKey])

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
    setDepartment('all')
    setSearch('')
    setSelectedKey(null)
  }

  const handleImported = async () => {
    await reload()
    showToast('考勤数据已更新')
  }

  const handleDeleted = async () => {
    await reload()
    showToast('数据已删除')
  }

  const recentPoints = points.slice(-3)
  const recentOvertime =
    recentPoints.length > 0
      ? recentPoints.reduce((sum, point) => sum + point.overtimeHours, 0) / recentPoints.length
      : 0

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
        sub={`近 3 个月月均 ${formatNumber(recentOvertime)} h`}
        {...buildCountDelta(latest.overtimeHours, previous?.overtimeHours, 'neutral')}
      />
      <KpiCard
        label="出勤率"
        value={formatRate(latest.rate)}
        sub={`实际打卡 ${formatNumber(latest.attendedDays)} / 应出勤 ${formatNumber(latest.expectedDays)} 天`}
        {...buildRateDelta(latest.rate, previous?.rate)}
      />
      <KpiCard
        label="覆盖月份"
        value={String(points.length)}
        unit="个月"
        sub={`${countEmployees(scopeRecords)} 名员工 · ${scopeRecords.length} 条记录`}
        deltaText={`最新 ${formatMonthFull(latest.month)}`}
        deltaTone="neutral"
        deltaDirection="flat"
      />
    </>
  ) : null

  return (
    <div className="app-shell">
      <Header
        email={email}
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
                departments={departments}
                department={department}
                onDepartmentChange={setDepartment}
                search={search}
                onSearchChange={handleSearchChange}
                employeeOptions={employeeOptions}
                personalMode={Boolean(selectedEmployee)}
                summary={`${scopeLabel} · ${points.length} 个月 · ${scopeRecords.length} 条记录`}
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
                  <p>换一个部门或姓名关键词，或清除筛选查看全部记录。</p>
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
                          最新月份 {latest ? formatMonthFull(latest.month) : '—'}
                          {latestPeriodDetail ? ` · ${latestPeriodDetail}` : ''} · 与上一期对比
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
                            ? `${selectedEmployee.employee_name} 的个人逐月数据`
                            : `${scopeLabel} · 所有图表共用当前筛选`}
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

                  <MonthlyTable points={points} periods={periods} scopeLabel={scopeLabel} />

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
