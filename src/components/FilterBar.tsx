import { ChevronDown, Search, X } from 'lucide-react'
import { formatMonthFull } from '../lib/format'

export interface EmployeeOption {
  key: string
  name: string
  department: string
}

interface FilterBarProps {
  months: string[]
  /** null 表示全部月份；数组表示用户选中的月份，可多选对比 */
  selectedMonths: string[] | null
  onSelectAllMonths: () => void
  onToggleMonth: (value: string) => void
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
  selectedMonths,
  onSelectAllMonths,
  onToggleMonth,
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
  const allMonthsSelected = selectedMonths === null

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

      <div className="month-filter">
        <span className="filter-label month-filter-label">
          月份对比
          <span className="field-hint">可多选，单选即单独查看</span>
        </span>
        <div className="month-chips" role="group" aria-label="选择要查看或对比的月份">
          <button
            type="button"
            className="month-chip"
            aria-pressed={allMonthsSelected}
            onClick={onSelectAllMonths}
          >
            全部月份
          </button>
          {months.map((value) => {
            const active = selectedMonths?.includes(value) ?? false
            return (
              <button
                key={value}
                type="button"
                className="month-chip"
                aria-pressed={active}
                onClick={() => onToggleMonth(value)}
              >
                {formatMonthFull(value)}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
