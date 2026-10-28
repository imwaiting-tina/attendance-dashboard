import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CircleAlert, Database, Loader2, Trash2, X } from 'lucide-react'
import { formatDateCompact, formatDateTime, formatMonthFull } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { AttendancePeriod } from '../lib/types'

interface DataManagementDialogProps {
  open: boolean
  onClose: () => void
  periods: AttendancePeriod[]
  onDeleted: () => Promise<void> | void
}

export function DataManagementDialog({
  open,
  onClose,
  periods,
  onDeleted,
}: DataManagementDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const wasOpenRef = useRef(false)
  const [confirmMonth, setConfirmMonth] = useState<string | null>(null)
  const [deletingMonth, setDeletingMonth] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      if (!dialog.open) dialog.showModal()
      if (!wasOpenRef.current) {
        setConfirmMonth(null)
        setDeletingMonth(null)
        setError(null)
        setSuccessMessage(null)
      }
    } else if (dialog.open) {
      dialog.close()
    }
    wasOpenRef.current = open
  }, [open])

  const requestClose = () => {
    if (deletingMonth) return
    onClose()
  }

  const handleDelete = async (period: AttendancePeriod) => {
    if (!supabase) return
    setDeletingMonth(period.month)
    setError(null)
    setSuccessMessage(null)

    const { error: deleteError } = await supabase.rpc('delete_attendance_period', {
      p_month: period.month,
    })

    if (deleteError) {
      setError(`删除失败：${deleteError.message}`)
    } else {
      setSuccessMessage(`已删除 ${formatMonthFull(period.month)}，员工记录一并移除。`)
      setConfirmMonth(null)
      await onDeleted()
    }
    setDeletingMonth(null)
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="manage-dialog-title"
      onClose={() => {
        if (wasOpenRef.current) onClose()
      }}
      onCancel={(event) => {
        if (deletingMonth) event.preventDefault()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div className="modal-panel modal-panel-wide">
        <header className="modal-head">
          <div>
            <h2 id="manage-dialog-title">数据管理</h2>
            <p>查看已导入月份、来源文件与删除记录。</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={requestClose}
            disabled={Boolean(deletingMonth)}
            aria-label="关闭数据管理窗口"
          >
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          {error ? (
            <div className="alert alert-error" role="alert">
              <CircleAlert size={16} />
              <span>{error}</span>
            </div>
          ) : null}
          {successMessage ? (
            <div className="alert alert-success" role="status">
              <Database size={16} />
              <span>{successMessage}</span>
            </div>
          ) : null}

          {periods.length === 0 ? (
            <div className="manage-empty">
              <Database size={22} aria-hidden="true" />
              <p>还没有导入任何月份。</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table manage-table">
                <caption className="sr-only">已导入的考勤月份</caption>
                <thead>
                  <tr>
                    <th scope="col">月份</th>
                    <th scope="col">统计周期</th>
                    <th scope="col">员工数</th>
                    <th scope="col">来源文件</th>
                    <th scope="col">导入时间</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr key={period.month}>
                      <th scope="row" className="manage-month">
                        {formatMonthFull(period.month)}
                      </th>
                      <td>
                        {formatDateCompact(period.period_start)}–{formatDateCompact(period.period_end)}
                      </td>
                      <td className="num">{period.employee_count} 人</td>
                      <td className="manage-file" title={period.source_file ?? ''}>
                        {period.source_file ?? '—'}
                      </td>
                      <td>{formatDateTime(period.imported_at)}</td>
                      <td>
                        {confirmMonth === period.month ? (
                          <span className="confirm-actions">
                            <span className="confirm-text">
                              <AlertTriangle size={13} />
                              删除后需重新导入
                            </span>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => void handleDelete(period)}
                              disabled={Boolean(deletingMonth)}
                            >
                              {deletingMonth === period.month ? (
                                <Loader2 size={14} className="spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                              确认删除
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setConfirmMonth(null)}
                              disabled={Boolean(deletingMonth)}
                            >
                              取消
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm danger-text"
                            onClick={() => setConfirmMonth(period.month)}
                          >
                            <Trash2 size={14} />
                            删除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="modal-foot">
          <p className="modal-foot-note">共 {periods.length} 个月 · 删除操作不可撤销</p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={requestClose}
              disabled={Boolean(deletingMonth)}
            >
              关闭
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  )
}
