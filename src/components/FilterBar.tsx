import { ChevronDown, Search, X } from 'lucide-react'
import { formatMonthFull } from '../lib/format'

export interface EmployeeOption {
  key: string
  name: string
  department: string
}

interface FilterBarProps {
  months: string[]
  month: string
  onMonthChange: (value: string) => void
  departments: string[]
  department: string
  onDepartmentChange: (value: string) => void
  search: string
  onSearchChange: (value: string) => void
  employeeOptions: EmployeeOption[]
  personalMode: boolean
  summary: string
  filterActive: boolean
  onReset: () => void
}

export function FilterBar({
  months,
  month,
  onMonthChange,
  departments,
  department,
  onDepartmentChange,
  search,
  onSearchChange,
  employeeOptions,
  personalMode,
  summary,
  filterActive,
  onReset,
}: FilterBarProps) {
  return (
    <section className="card filter-bar" aria-label="筛选条件">
      <div className="filter-controls">
        <label className="filter-field">
          <span className="filter-label">部门</span>
          <span className="select-wrap">
            <select
              value={department}
              onChange={(event) => onDepartmentChange(event.target.value)}
              disabled={personalMode}
              title={personalMode ? '个人视图下不使用部门筛选' : undefined}
              aria-label="按部门筛选"
            >
              <option value="all">全部部门</option>
              {departments.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </span>
        </label>

        <label className="filter-field">
          <span className="filter-label">
            月份
            <span className="field-hint">单月即单独查看</span>
          </span>
          <span className="select-wrap">
            <select
              value={month}
              onChange={(event) => onMonthChange(event.target.value)}
              aria-label="按月份筛选"
            >
              <option value="all">全部月份（趋势对比）</option>
              {months.map((value) => (
                <option key={value} value={value}>
                  {formatMonthFull(value)}
                </option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </span>
        </label>

        <label className="filter-field filter-field-search">
          <span className="filter-label">
            员工
            <span className="field-hint">输入姓名筛选，选中查看个人趋势</span>
          </span>
          <span className="search-wrap">
            <Search size={15} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              list="employee-name-options"
              placeholder="搜索姓名"
              autoComplete="off"
              aria-label="搜索员工姓名"
            />
            {search ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => onSearchChange('')}
                aria-label="清除员工搜索"
              >
                <X size={14} />
              </button>
            ) : null}
            <datalist id="employee-name-options">
              {employeeOptions.map((employee) => (
                <option key={employee.key} value={employee.name}>
                  {employee.department ? `${employee.name} · ${employee.department}` : employee.name}
                </option>
              ))}
            </datalist>
          </span>
        </label>
      </div>

      <div className="filter-meta">
        <span className="filter-summary">{summary}</span>
        {filterActive ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
            清除筛选
          </button>
        ) : null}
      </div>
    </section>
  )
}
