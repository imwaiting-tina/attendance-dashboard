function escapeCell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

/** 导出带 BOM 的 CSV，Excel 打开中文不乱码 */
export function downloadCsv(fileName: string, headers: string[], rows: Array<Array<string | number>>): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','))
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|\s]+/g, '_')
}
