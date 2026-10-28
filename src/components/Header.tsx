import {
  ChartColumn,
  Database,
  LogOut,
  Moon,
  Sun,
  Upload,
  UserRound,
} from 'lucide-react'
import { formatMonthRange } from '../lib/format'
import type { ThemeMode } from '../lib/theme'
import type { AttendancePeriod } from '../lib/types'

interface HeaderProps {
  email: string
  periods: AttendancePeriod[]
  mode: ThemeMode
  onToggleTheme: () => void
  onOpenImport: () => void
  onOpenManage: () => void
  onSignOut: () => void
}

export function Header({
  email,
  periods,
  mode,
  onToggleTheme,
  onOpenImport,
  onOpenManage,
  onSignOut,
}: HeaderProps) {
  const months = periods.map((period) => period.month)
  const range = formatMonthRange(months)

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ChartColumn size={19} strokeWidth={2.2} />
          </span>
          <div className="brand-text">
            <h1>考勤汇总仪表盘</h1>
            <p>Attendance overview</p>
          </div>
        </div>

        <div className="topbar-coverage" title={months.length ? `已覆盖 ${months.length} 个月` : '尚未导入数据'}>
          <span className="coverage-range">{range}</span>
          <span className="coverage-dot" aria-hidden="true" />
          <span>{months.length} 个月</span>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            title={mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            aria-label={mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenManage}
            title="数据管理"
            aria-label="数据管理"
          >
            <Database size={16} />
            <span className="btn-label">数据管理</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenImport}
            title="导入考勤表"
            aria-label="导入考勤表"
          >
            <Upload size={16} />
            <span className="btn-label">导入考勤表</span>
          </button>
          <div className="user-chip" title={email}>
            <UserRound size={15} aria-hidden="true" />
            <span className="user-email">{email}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onSignOut}
            title="退出登录"
            aria-label="退出登录"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
