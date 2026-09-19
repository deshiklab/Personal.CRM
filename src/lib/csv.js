/* CSV utilities — RFC-4180 quoting + Excel-friendly BOM */
const esc = v => {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** headers: [{ label, get }] · rows: plain objects */
export const toCSV = (headers, rows) =>
  [headers.map(h => esc(h.label)).join(','),
   ...rows.map(r => headers.map(h => esc(h.get(r))).join(','))].join('\r\n')

export const downloadCSV = (filename, headers, rows) => {
  const blob = new Blob(['﻿' + toCSV(headers, rows)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
