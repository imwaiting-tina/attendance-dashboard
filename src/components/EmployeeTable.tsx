import type { EmployeeSummary } from '../lib/aggregate'
import { formatMonthFull, formatNumber } from '../lib/format'
import { RateCell } from './RateCell'

interface EmployeeTableProps {
  employees: EmployeeSummary[]
  onSelect: (employeeKey: string) => void
}

export function EmployeeTable({ employees, onSelect }: EmployeeTableProps) {
  return (
    <section className="card table-card">
      <header className="card-head table-head">
        <div className="card-heading">
          <h2>员工概览</h2>
          <p>按当前筛选汇总；点击姓名查看个人趋势</p>
        </div>
        <span className="count-badge">{employees.length} 人</span>
      </header>

      <div className="table-scroll employee-table-scroll">
        <table className="data-table employee-table">
          <caption className="sr-only">员工考勤汇总</caption>
          <thead>
            <tr>
              <th scope="col">员工</th>
              <th scope="col" className="num">
                记录
              </th>
              <th scope="col" className="num">
                迟到
              </th>
              <th scope="col" className="num">
                严重迟到
              </th>
              <th scope="col" className="num">
                缺卡
              </th>
              <th scope="col" className="num">
                加班(小时)
              </th>
              <th scope="col" className="num">
                出勤率
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  没有匹配的员工
                </td>
              </tr>
            ) : (
              employees.map((employee) => (
                <tr
                  key={employee.employee_key}
                  className="employee-row"
                  onClick={() => onSelect(employee.employee_key)}
                >
                  <th scope="row" className="employee-name-cell">
                    <button
                      type="button"
                      className="name-link"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelect(employee.employee_key)
                      }}
                    >
                      {employee.employee_name}
                    </button>
                    <span className="employee-meta">
                      {employee.department_group || '未分部门'} · 最近 {formatMonthFull(employee.lastMonth)}
                    </span>
                  </th>
                  <td className="num">{employee.months} 个月</td>
                  <td className="num">{formatNumber(employee.late)}</td>
                  <td className="num">{formatNumber(employee.severeLate)}</td>
                  <td className="num">{formatNumber(employee.missingPunch)}</td>
                  <td className="num">{formatNumber(employee.overtimeHours)}</td>
                  <td className="num">
                    <RateCell rate={employee.rate} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="table-note">出勤率按所选范围内实际打卡天数合计 ÷ 应出勤天数合计计算。</p>
    </section>
  )
}
