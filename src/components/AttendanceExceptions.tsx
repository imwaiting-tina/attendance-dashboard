import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { downloadCsv } from '../lib/csv'
import { formatMonthFull, formatNumber } from '../lib/format'
import type { AttendanceRecord } from '../lib/types'

interface AttendanceExceptionsProps {
  records: AttendanceRecord[]
  onSelect: (employeeKey: string) => void
}

/** 兼容旧数据：没有 proof_status 时用 proof_y 推断 Y */
function proofStatusOf(record: AttendanceRecord): string {
  if (record.proof_status) return record.proof_status.toUpperCase()
  return record.proof_y ? 'Y' : ''
}

function ProofStatusBadge({ status }: { status: string }) {
  if (status.startsWith('Y')) {
    return (
      <span className="badge badge-success" title="Y 表示当月缺卡均已补上">
        Y · 已补
      </span>
    )
  }
  if (status.startsWith('N')) {
    return (
      <span className="badge badge-danger" title="N 表示存在考勤异常">
        N · 异常
      </span>
    )
  }
  return <span className="status-empty">—</span>
}

function hasException(record: AttendanceRecord): boolean {
  const status = proofStatusOf(record)
  return status.startsWith('N') || record.abnormal_days > 0 || record.abnormal_remark.trim() !== ''
}

export function AttendanceExceptions({ records, onSelect }: AttendanceExceptionsProps) {
  const exceptions = useMemo(
    () =>
      records
        .filter(hasException)
        .sort(
          (a, b) =>
            b.month.localeCompare(a.month) ||
            a.employee_name.localeCompare(b.employee_name, 'zh-Hans-CN'),
        ),
    [records],
  )

  if (exceptions.length === 0) return null

  const handleExport = () => {
    const headers = [
      '月份',
      '员工',
      '部门',
      '缺卡',
      '补卡证明',
      '考勤异常(天)',
      '备注',
    ]
    const rows = exceptions.map((record) => [
      record.month,
      record.employee_name,
      record.department || record.department_group,
      record.missing_punch_count,
      proofStatusOf(record) || '未填',
      record.abnormal_days,
      record.abnormal_remark,
    ])
    downloadCsv(`考勤异常明细_${exceptions.length}条.csv`, headers, rows)
  }

  return (
    <section className="card table-card">
      <header className="card-head table-head">
        <div className="card-heading">
          <h2>考勤异常明细</h2>
          <p>仅列出补卡证明为 N、异常天数大于 0 或带备注的记录；备注取自原表「备注」列</p>
        </div>
        <div className="table-head-actions">
          <span className="count-badge">{exceptions.length} 条</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport}>
            <Download size={15} />
            导出明细
          </button>
        </div>
      </header>

      <div className="table-scroll">
        <table className="data-table exception-table">
          <caption className="sr-only">考勤异常明细，含补卡证明状态与备注</caption>
          <thead>
            <tr>
              <th scope="col">月份</th>
              <th scope="col">员工</th>
              <th scope="col">部门</th>
              <th scope="col">缺卡</th>
              <th scope="col">补卡证明</th>
              <th scope="col">考勤异常(天)</th>
              <th scope="col">备注</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((record) => {
              const status = proofStatusOf(record)
              return (
                <tr key={`${record.month}-${record.employee_key}`}>
                  <td>{formatMonthFull(record.month)}</td>
                  <th scope="row" className="exception-name-cell">
                    <button
                      type="button"
                      className="name-link"
                      onClick={() => onSelect(record.employee_key)}
                    >
                      {record.employee_name}
                    </button>
                  </th>
                  <td>{record.department || record.department_group || '—'}</td>
                  <td className="num">{formatNumber(record.missing_punch_count)}</td>
                  <td>
                    <ProofStatusBadge status={status} />
                  </td>
                  <td className="num">{formatNumber(record.abnormal_days)}</td>
                  <td className="exception-remark">{record.abnormal_remark || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="table-note">
        补卡人数按 Y 员工计数：同一员工同一月份无论缺卡几次，只计 1 人。N 表示存在考勤异常，
        备注为原表对异常原因的补充说明。
      </p>
    </section>
  )
}
