import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { formatNumber, formatRate } from '../lib/format'
import { formatMonthLabel } from '../lib/normalize'
import { parseAttendanceWorkbook } from '../lib/parseAttendance'
import { supabase } from '../lib/supabase'
import type { ParsedWorkbook, PeriodPayload } from '../lib/types'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  existingMonths: Set<string>
  onImported: () => Promise<void> | void
}

type PreviewStatus = 'ready' | 'importing' | 'success' | 'error'

interface ImportPreview {
  id: string
  file: File
  parsed: ParsedWorkbook | null
  month: string
  error: string | null
  status: PreviewStatus
  importError?: string
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_FILE_BYTES = 30 * 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function ImportDialog({ open, onClose, existingMonths, onImported }: ImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const [previews, setPreviews] = useState<ImportPreview[]>([])
  const [parsing, setParsing] = useState(false)
  const [parseProgress, setParseProgress] = useState<{ done: number; total: number } | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      if (!dialog.open) dialog.showModal()
      if (!wasOpenRef.current) {
        setPreviews([])
        setParsing(false)
        setParseProgress(null)
        setImporting(false)
        setDone(false)
        setFileError(null)
        setDragActive(false)
      }
    } else if (dialog.open) {
      dialog.close()
    }
    wasOpenRef.current = open
  }, [open])

  const monthCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const preview of previews) {
      if (!MONTH_PATTERN.test(preview.month)) continue
      counts.set(preview.month, (counts.get(preview.month) ?? 0) + 1)
    }
    return counts
  }, [previews])

  const duplicateMonths = useMemo(
    () => [...monthCounts.entries()].filter(([, count]) => count > 1).map(([month]) => month),
    [monthCounts],
  )

  const importable = previews.filter(
    (preview) =>
      preview.parsed &&
      MONTH_PATTERN.test(preview.month) &&
      preview.status !== 'success' &&
      preview.status !== 'importing',
  )
  const successCount = previews.filter((preview) => preview.status === 'success').length
  const failedCount = previews.filter((preview) => preview.status === 'error' && preview.importError).length
  const canImport =
    !parsing && !importing && duplicateMonths.length === 0 && importable.length > 0

  const requestClose = () => {
    if (importing) return
    onClose()
  }

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setFileError(null)
    setDone(false)
    const existingIds = new Set(previews.map((preview) => preview.id))
    const accepted = files.filter((file) => {
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        setFileError('仅支持 .xlsx 或 .xls 文件')
        return false
      }
      return true
    })

    if (accepted.length === 0) return

    setParsing(true)
    let doneCount = 0
    for (const file of accepted) {
      setParseProgress({ done: doneCount, total: accepted.length })
      const id = `${file.name}:${file.size}:${file.lastModified}`
      if (existingIds.has(id)) {
        doneCount += 1
        continue
      }
      existingIds.add(id)

      if (file.size > MAX_FILE_BYTES) {
        setPreviews((current) => [
          ...current,
          {
            id,
            file,
            parsed: null,
            month: '',
            error: `文件超过 30 MB（${formatFileSize(file.size)}），请检查文件是否异常`,
            status: 'ready',
          },
        ])
        doneCount += 1
        continue
      }

      try {
        const buffer = await file.arrayBuffer()
        const parsed = parseAttendanceWorkbook(buffer, file.name)
        setPreviews((current) => [
          ...current,
          {
            id,
            file,
            parsed,
            month: parsed.month ?? '',
            error: null,
            status: 'ready',
          },
        ])
      } catch (parseError) {
        setPreviews((current) => [
          ...current,
          {
            id,
            file,
            parsed: null,
            month: '',
            error: errorMessage(parseError),
            status: 'ready',
          },
        ])
      }

      doneCount += 1
      setParseProgress({ done: doneCount, total: accepted.length })
      // 让浏览器有机会刷新进度
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    }

    setParsing(false)
    setParseProgress(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void addFiles(event.target.files)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    if (parsing || importing) return
    void addFiles(event.dataTransfer.files)
  }

  const updateMonth = (id: string, value: string) => {
    setPreviews((current) =>
      current.map((preview) => (preview.id === id ? { ...preview, month: value.trim(), importError: undefined } : preview)),
    )
  }

  const removePreview = (id: string) => {
    setPreviews((current) => current.filter((preview) => preview.id !== id))
  }

  const handleImport = async () => {
    if (!supabase || !canImport) return
    setImporting(true)
    setDone(false)
    setFileError(null)

    let success = 0
    for (const preview of importable) {
      setPreviews((current) =>
        current.map((item) => (item.id === preview.id ? { ...item, status: 'importing', importError: undefined } : item)),
      )

      try {
        if (!preview.parsed) throw new Error('没有可导入的解析结果')
        const period: PeriodPayload = {
          month: preview.month,
          label: formatMonthLabel(preview.month),
          period_start: preview.parsed.periodStart,
          period_end: preview.parsed.periodEnd,
          source_file: preview.file.name,
          employee_count: preview.parsed.records.length,
        }
        const records = preview.parsed.records.map((record) => ({ ...record, month: preview.month }))
        const { error } = await supabase.rpc('import_attendance', {
          p_period: period,
          p_records: records,
        })
        if (error) throw new Error(error.message)

        success += 1
        setPreviews((current) =>
          current.map((item) => (item.id === preview.id ? { ...item, status: 'success' } : item)),
        )
      } catch (importError) {
        setPreviews((current) =>
          current.map((item) =>
            item.id === preview.id
              ? { ...item, status: 'error', importError: errorMessage(importError) }
              : item,
          ),
        )
      }
    }

    setImporting(false)
    setDone(true)
    if (success > 0) void onImported()
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="import-dialog-title"
      onClose={() => {
        if (wasOpenRef.current) onClose()
      }}
      onCancel={(event) => {
        if (importing) event.preventDefault()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div className="modal-panel modal-panel-wide">
        <header className="modal-head">
          <div>
            <h2 id="import-dialog-title">导入考勤表</h2>
            <p>支持一次选择多个月度文件；同一月份重复导入会覆盖原数据。</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={requestClose}
            disabled={importing}
            aria-label="关闭导入窗口"
          >
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          <div
            className={`dropzone ${dragActive ? 'dropzone-active' : ''} ${previews.length > 0 ? 'dropzone-compact' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setDragActive(false)
            }}
            onDrop={handleDrop}
          >
            <span className="dropzone-icon" aria-hidden="true">
              {parsing ? <Loader2 size={22} className="spin" /> : <FileSpreadsheet size={22} />}
            </span>
            <div className="dropzone-text">
              <strong>{parsing ? '正在解析文件…' : '拖拽考勤表到这里'}</strong>
              <span>
                {parsing && parseProgress
                  ? `已处理 ${parseProgress.done} / ${parseProgress.total} 个文件`
                  : '支持 .xlsx / .xls，可一次选择多个月份'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={parsing || importing}
            >
              <Upload size={15} />
              {previews.length > 0 ? '继续添加' : '选择文件'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              multiple
              hidden
              onChange={handleFileInput}
            />
          </div>

          {fileError ? (
            <div className="alert alert-error" role="alert">
              <CircleAlert size={16} />
              <span>{fileError}</span>
            </div>
          ) : null}

          <div className="parse-progress" aria-live="polite">
            {parseProgress ? `解析进度：${parseProgress.done} / ${parseProgress.total}` : ''}
          </div>

          {previews.length > 0 ? (
            <div className="import-list">
              {previews.map((preview) => {
                const monthValid = MONTH_PATTERN.test(preview.month)
                const duplicate = monthValid && (monthCounts.get(preview.month) ?? 0) > 1
                const overwrite = monthValid && existingMonths.has(preview.month)
                const warnings = preview.parsed
                  ? preview.parsed.warnings.filter(
                      (warning) =>
                        !(monthValid && warning.includes('未能从文件名识别月份')),
                    )
                  : []
                const rate = preview.parsed
                  ? preview.parsed.totals.expectedDays > 0
                    ? preview.parsed.totals.attendedDays / preview.parsed.totals.expectedDays
                    : null
                  : null

                return (
                  <article
                    key={preview.id}
                    className={`import-item import-status-${preview.status}`}
                  >
                    <div className="import-item-main">
                      <div className="import-item-title">
                        <FileSpreadsheet size={16} aria-hidden="true" />
                        <strong title={preview.file.name}>{preview.file.name}</strong>
                        <span className="file-size">{formatFileSize(preview.file.size)}</span>
                        {preview.status === 'success' ? (
                          <span className="badge badge-success">
                            <CheckCircle2 size={12} />
                            已导入
                          </span>
                        ) : null}
                        {duplicate ? <span className="badge badge-danger">本次重复</span> : null}
                        {overwrite && preview.status === 'ready' ? (
                          <span className="badge badge-warning">将覆盖</span>
                        ) : null}
                      </div>

                      {preview.error ? (
                        <p className="import-error">
                          <CircleAlert size={14} />
                          {preview.error}
                        </p>
                      ) : preview.parsed ? (
                        <>
                          <div className="import-item-meta">
                            <span>{preview.parsed.records.length} 人</span>
                            <span>迟到 {formatNumber(preview.parsed.totals.late)}</span>
                            <span>缺卡 {formatNumber(preview.parsed.totals.missingPunch)}</span>
                            <span>加班 {formatNumber(preview.parsed.totals.overtimeHours)} h</span>
                            <span>出勤率 {formatRate(rate)}</span>
                          </div>
                          <div className="import-item-period">
                            {preview.parsed.periodStart ?? '—'} 至 {preview.parsed.periodEnd ?? '—'}
                          </div>
                          {warnings.length > 0 ? (
                            <details className="warning-details">
                              <summary>
                                <AlertTriangle size={13} />
                                {warnings.length} 条提示
                              </summary>
                              <ul>
                                {warnings.map((warning, index) => (
                                  <li key={`${preview.id}-warning-${index}`}>{warning}</li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </>
                      ) : null}

                      {preview.importError ? (
                        <p className="import-error">
                          <CircleAlert size={14} />
                          导入失败：{preview.importError}
                        </p>
                      ) : null}
                    </div>

                    <div className="import-item-side">
                      <label className={`month-field ${!monthValid ? 'month-field-invalid' : ''}`}>
                        <span>月份</span>
                        <input
                          type="text"
                          value={preview.month}
                          onChange={(event) => updateMonth(preview.id, event.target.value)}
                          placeholder="YYYY-MM"
                          inputMode="numeric"
                          pattern="\d{4}-(0[1-9]|1[0-2])"
                          disabled={importing || preview.status === 'success'}
                          aria-label={`${preview.file.name} 的月份`}
                        />
                      </label>
                      {!monthValid ? <span className="month-hint">请填写如 2026-10</span> : null}
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => removePreview(preview.id)}
                        disabled={importing || preview.status === 'success'}
                        aria-label={`移除 ${preview.file.name}`}
                        title="移除文件"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="import-empty-hint">
              文件在浏览器本地解析，上传前可以先核对月份、员工数与合计；只有确认导入后才会写入数据库。
            </div>
          )}

          {duplicateMonths.length > 0 ? (
            <div className="alert alert-warning" role="alert">
              <AlertTriangle size={16} />
              <span>
                本次选择中有重复月份：{duplicateMonths.map(formatMonthLabel).join('、')}。请先移除重复文件，避免后者覆盖前者。
              </span>
            </div>
          ) : null}

          {done ? (
            <div className={`alert ${failedCount > 0 ? 'alert-warning' : 'alert-success'}`} role="status">
              {failedCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              <span>
                已成功导入 {successCount} 个月
                {failedCount > 0 ? `，${failedCount} 个文件失败，可修正后重试。` : '，仪表盘已更新。'}
              </span>
            </div>
          ) : null}
        </div>

        <footer className="modal-foot">
          <p className="modal-foot-note">
            {previews.length === 0
              ? '尚未选择文件'
              : `已选择 ${previews.length} 个文件 · ${importable.length} 个待导入`}
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={importing}>
              {done && successCount > 0 ? '完成' : '取消'}
            </button>
            {(!done || failedCount > 0 || importable.length > 0) && previews.length > 0 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleImport()}
                disabled={!canImport}
              >
                {importing ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                {importing
                  ? '正在导入…'
                  : done
                    ? `重试失败项 (${importable.length})`
                    : `导入 ${importable.length} 个月`}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </dialog>
  )
}
