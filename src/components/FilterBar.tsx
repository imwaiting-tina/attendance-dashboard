import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { formatMonthFull } from '../lib/format'
import { scoreEmployeeKeyword } from '../lib/pinyinSearch'

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
  onSelectEmployee: (employeeKey: string) => void
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
  onSelectEmployee,
  employeeOptions,
  personalMode,
  summary,
  filterActive,
  onReset,
}: FilterBarProps) {
  const allMonthsSelected = selectedMonths === null
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const suggestions = useMemo(() => {
    const term = search.trim()
    return employeeOptions
      .map((employee) => ({
        employee,
        score: term ? scoreEmployeeKeyword(employee.name, term) : 0,
      }))
      .filter((item) => item.score >= 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.employee.name.localeCompare(b.employee.name, 'zh-Hans-CN'),
      )
      .slice(0, 8)
      .map((item) => item.employee)
  }, [employeeOptions, search])

  const chooseEmployee = (employee: EmployeeOption) => {
    onSelectEmployee(employee.key)
    setSuggestionsOpen(false)
    setActiveIndex(-1)
    searchInputRef.current?.blur()
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!suggestions.length) return
      if (!suggestionsOpen) {
        setSuggestionsOpen(true)
        setActiveIndex(0)
        return
      }
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!suggestions.length) return
      setSuggestionsOpen(true)
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
      return
    }
    if (event.key === 'Enter') {
      const target =
        activeIndex >= 0 ? suggestions[activeIndex] : suggestions.length === 1 ? suggestions[0] : null
      if (suggestionsOpen && target) {
        event.preventDefault()
        chooseEmployee(target)
      }
      return
    }
    if (event.key === 'Escape') {
      setSuggestionsOpen(false)
      setActiveIndex(-1)
    }
  }

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

        <div className="filter-field filter-field-search">
          <label className="filter-label" htmlFor="employee-search-input">
            员工
            <span className="field-hint">姓名、拼音或首字母</span>
          </label>
          <div className="search-wrap">
            <Search size={15} className="search-icon" aria-hidden="true" />
            <input
              ref={searchInputRef}
              id="employee-search-input"
              type="text"
              value={search}
              onChange={(event) => {
                onSearchChange(event.target.value)
                setSuggestionsOpen(true)
                // 默认高亮最匹配项，输入后直接回车即可选中
                setActiveIndex(0)
              }}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={() => {
                setSuggestionsOpen(false)
                setActiveIndex(-1)
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="搜索姓名"
              autoComplete="off"
              role="combobox"
              aria-label="搜索员工姓名、拼音或首字母"
              aria-autocomplete="list"
              aria-expanded={suggestionsOpen}
              aria-controls="employee-search-suggestions"
              aria-activedescendant={
                suggestionsOpen && activeIndex >= 0
                  ? `employee-search-option-${activeIndex}`
                  : undefined
              }
            />
            {search ? (
              <button
                type="button"
                className="search-clear"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSearchChange('')
                  setSuggestionsOpen(false)
                  setActiveIndex(-1)
                  searchInputRef.current?.focus()
                }}
                aria-label="清除员工搜索"
              >
                <X size={14} />
              </button>
            ) : null}

            {suggestionsOpen ? (
              <div className="search-suggestions" id="employee-search-suggestions">
                {suggestions.length ? (
                  <ul role="listbox" aria-label="员工搜索建议">
                    {suggestions.map((employee, index) => (
                      <li
                        key={employee.key}
                        id={`employee-search-option-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={`search-option${index === activeIndex ? ' is-active' : ''}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => chooseEmployee(employee)}
                      >
                        <span className="search-option-name">{employee.name}</span>
                        <span className="search-option-department">
                          {employee.department || '未分部门'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="search-empty">没有匹配的员工</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
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
