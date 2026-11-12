import Papa from 'papaparse'
import type { Row } from '@/stores/dataStore'
import { connectorForFile, validateConnectorDataset } from './connectors'

const MAX_IMPORT_BYTES = 100 * 1024 * 1024

function normalizeRows(input: Row[]): { rows: Row[]; columns: string[] } {
  const columns = Array.from(new Set(input.flatMap((row) => Object.keys(row))))
  const rows = input.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? '']))) as Row[]
  return { rows, columns }
}

export async function parseFile(file: File): Promise<{ rows: Row[]; columns: string[] }> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`File exceeds the ${MAX_IMPORT_BYTES / 1024 / 1024} MB import limit`)
  }

  // Registered connectors are intentionally checked before built-in parsers so
  // applications can override or extend a format without modifying DataForge.
  const customConnector = connectorForFile(file)
  if (customConnector) return validateConnectorDataset(await customConnector.open(file))

  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await file.arrayBuffer()
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buf)
    const sheet = workbook.worksheets[0]
    if (!sheet) return { rows: [], columns: [] }
    const values = sheet.getSheetValues().slice(1) as Array<unknown[] | undefined>
    const header = (values.shift() ?? []).map((value, index) => String(value ?? `column_${index + 1}`))
    const rows = values.filter(Boolean).map((cells) => Object.fromEntries(header.map((column, index) => [column, cells?.[index + 1] ?? '']))) as Row[]
    return normalizeRows(rows)
  }

  if (ext === 'jsonl' || ext === 'ndjson') {
    const text = await file.text()
    const rows: Row[] = text.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))
    return normalizeRows(rows)
  }

  if (ext === 'json') {
    const text = await file.text()
    const data = JSON.parse(text)
    const rows: Row[] = Array.isArray(data) ? data : [data]
    return normalizeRows(rows)
  }

  // CSV via PapaParse (robust quoting, delimiter detection)
  const text = await file.text()
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true, dynamicTyping: false })
  const rows = parsed.data.filter((r) => Object.values(r).some((v) => v !== '' && v !== null))
  return normalizeRows(rows.length ? rows : parsed.meta.fields?.length ? [Object.fromEntries(parsed.meta.fields.map((field) => [field, '']))] as Row[] : [])
}

export function exportCsv(rows: Row[], columns: string[], filename = 'dataforge-export.csv') {
  const csv = Papa.unparse(rows, { columns })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export async function exportXlsx(rows: Row[], filename = 'dataforge-export.xlsx') {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  const columns = rows.length ? Object.keys(rows[0]) : []
  sheet.addRow(columns)
  rows.forEach((row) => sheet.addRow(columns.map((column) => row[column] ?? '')))
  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  URL.revokeObjectURL(url)
}
