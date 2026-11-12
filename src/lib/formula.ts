// @ts-nocheck
import { HyperFormula } from 'hyperformula'
import type { Row } from '@/stores/dataStore'
import { colLetter } from './utils'

let hf: HyperFormula | null = null
let sheetId = 0

function getInstance(rows: Row[], columns: string[]) {
  // Rebuild instance per call for correctness; HyperFormula is fast for <50k cells.
  // For >100k rows we will use paging (virtual grid) so this stays cheap.
  // Column names are DataForge metadata, not a hidden worksheet row. Keeping
  // only data here makes spreadsheet-style A1 references line up with the UI.
  const data: (string | number | null)[][] = rows.map((r) => columns.map((c) => {
      const v = r[c]
      if (v === null || v === undefined) return null
      if (typeof v === 'number') return v
      return String(v)
    }))
  // HyperFormula instance recreated per eval for simplicity (cheap for <50k cells)
  hf = HyperFormula.buildFromArray(data, {
    licenseKey: 'gpl-v3',
    evaluateNullToZero: true,
  })
  sheetId = hf.getSheetId(hf.getSheetName(0)!)!
  return { hf, sheetId }
}

export function evaluateCell(raw: unknown, rows: Row[], columns: string[], rowIndex: number, colIndex: number): string {
  const s = String(raw ?? '')
  if (!s.startsWith('=')) return s
  try {
    const { hf, sheetId } = getInstance(rows, columns)
    // Use HyperFormula cell address (0-based col/row, but data includes header row offset)
    // For single-cell eval we can use calculateFormula which supports A1 refs.
    const result = hf.calculateFormula(s, sheetId)
    if (result === null || result === undefined) return ''
    if (typeof result === 'number' && !Number.isFinite(result)) return '#DIV/0!'
    return String(result)
  } catch {
    // Fallback to legacy evaluator for VLOOKUP/XLOOKUP/CONCAT/LEFT/RIGHT/MID/IFERROR that HF may not cover
    return legacyFormulaValue(s, rows, columns)
  }
}

export function evaluateSheet(rows: Row[], columns: string[]): any[] {
  if (!rows.length) return []
  const { hf, sheetId } = getInstance(rows, columns)
  return rows.map((r, ri) => {
    const computed: Record<string, string> = {}
    columns.forEach((c, ci) => {
      const raw = r[c]
      if (String(raw).startsWith('=')) {
        const val = hf!.getCellValue({ sheet: sheetId, col: ci, row: ri })
        computed[c] = val === null || val === undefined ? '' : String(val)
      } else {
        computed[c] = String(raw ?? '')
      }
    })
    return { ...r, _computed: computed }
  })
}

// Legacy fallback kept for IFERROR, VLOOKUP etc - extracted from App.tsx:42
function legacyFormulaValue(input: string, rows: Row[], columns: string[]) {
  if (!input.startsWith('=')) return input
  const getCell = (reference: string) => {
    const match = reference.trim().match(/^\$?([A-Z]+)\$?(\d+)$/i)
    if (!match) return reference.replace(/^['"]|['"]$/g, '')
    const col = match[1].toUpperCase().charCodeAt(0) - 65
    return String(rows[Number(match[2]) - 1]?.[columns[col]] ?? '')
  }
  const splitArgs = (args: string) => {
    const parts: string[] = []; let part = ''; let quoted = false
    for (const char of args) { if (char === '"') quoted = !quoted; if (char === ',' && !quoted) { parts.push(part.trim()); part = '' } else part += char }
    parts.push(part.trim()); return parts
  }
  const source = input.slice(1).trim()
  const matchFunction = source.match(/^([A-Z]+)\((.*)\)$/i)
  if (matchFunction) {
    const name = matchFunction[1].toUpperCase(); const args = splitArgs(matchFunction[2])
    if (name === 'CONCAT') return args.map(getCell).join('')
    if (name === 'LEFT') return getCell(args[0]).slice(0, Number(getCell(args[1]) || 1))
    if (name === 'RIGHT') { const value = getCell(args[0]); return value.slice(-Number(getCell(args[1]) || 1)) }
    if (name === 'MID') return getCell(args[0]).slice(Number(getCell(args[1]) || 1) - 1, Number(getCell(args[2]) || 1) + Number(getCell(args[1]) || 1) - 1)
    if (name === 'IFERROR') { const value = getCell(args[0]); return value.startsWith('#') ? getCell(args[1]) : value }
    if (name === 'VLOOKUP' && args.length >= 3) {
      const rangeMatch = args[1].match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/i); if (!rangeMatch) return '#REF!'
      const lookup = getCell(args[0]); const targetColumn = rangeMatch[1].charCodeAt(0) - 65 + Number(args[2]) - 1
      for (let row = Number(rangeMatch[2]) - 1; row < Number(rangeMatch[4]); row++) if (String(rows[row]?.[columns[rangeMatch[1].charCodeAt(0) - 65]] ?? '') === lookup) return String(rows[row]?.[columns[targetColumn]] ?? '#N/A')
      return '#N/A'
    }
  }
  const cells = (value: string) => value.replace(/\$?([A-Z]+)\$?(\d+)/g, (_, letters, rowNum) => {
    const col = letters.charCodeAt(0) - 65
    const value = rows[Number(rowNum) - 1]?.[columns[col]]
    return String(typeof value === 'number' ? value : Number(value) || 0)
  })
  const range = (formula: string, name: string, fn: (numbers: number[]) => number) => formula.replace(new RegExp(`${name}\\(([A-Z]+)(\\d+):([A-Z]+)(\\d+)\\)`, 'gi'), (_, a, r1, b, r2) => {
    const numbers: number[] = []
    for (let r = Number(r1) - 1; r < Number(r2); r++) for (let c = a.charCodeAt(0) - 65; c <= b.charCodeAt(0) - 65; c++) {
      const v = Number(rows[r]?.[columns[c]])
      if (!Number.isNaN(v)) numbers.push(v)
    }
    return String(fn(numbers))
  })
  try {
    let formula = input.slice(1).toUpperCase()
    formula = range(formula, 'SUM', xs => xs.reduce((a, b) => a + b, 0))
    formula = range(formula, 'AVERAGE', xs => xs.reduce((a, b) => a + b, 0) / (xs.length || 1))
    formula = range(formula, 'COUNT', xs => xs.length)
    formula = range(formula, 'MIN', xs => Math.min(...xs))
    formula = range(formula, 'MAX', xs => Math.max(...xs))
    formula = formula.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/g, '($1 ? $2 : $3)')
    formula = cells(formula)
    if (!/^[0-9+\-*/().?\s:]+$/.test(formula)) return '#ERROR!'
    return String(Function(`"use strict"; return (${formula})`)())
  } catch { return '#ERROR!' }
}
