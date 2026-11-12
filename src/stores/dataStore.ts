import { create } from 'zustand'

export type Row = Record<string, string | number | null>

export const seedRows: Row[] = [
  { order_id: 'ORD-1001', customer: 'Alya Pratama', region: 'Jakarta', category: 'Electronics', units: 2, revenue: 12500000, date: '2025-01-04', status: 'Completed' },
  { order_id: 'ORD-1002', customer: 'Rizky Maulana', region: 'Bandung', category: 'Home & Living', units: 1, revenue: 890000, date: '2025-01-04', status: 'Completed' },
  { order_id: 'ORD-1003', customer: 'Nadia Lestari', region: 'Surabaya', category: 'Electronics', units: 3, revenue: 7600000, date: '2025-01-05', status: 'Processing' },
  { order_id: 'ORD-1004', customer: 'Bima Saputra', region: 'Jakarta', category: 'Fashion', units: 4, revenue: 1400000, date: '2025-01-06', status: 'Completed' },
]

export const initialCols = ['order_id', 'customer', 'region', 'category', 'units', 'revenue', 'date', 'status']

type DataState = {
  rows: Row[]
  columns: string[]
  history: Row[][]
  future: Row[][]
  setRows: (rows: Row[], columns?: string[]) => void
  updateCell: (row: number, col: string, value: string) => void
  undo: () => void
  redo: () => void
  insertRow: (after: number) => void
  deleteRow: (index: number) => void
  insertColumn: (name?: string) => void
}

export const useDataStore = create<DataState>((set, get) => ({
  rows: seedRows,
  columns: initialCols,
  history: [],
  future: [],
  setRows: (rows, columns) =>
    set({ rows, columns: columns ?? (rows[0] ? Object.keys(rows[0]) : []), history: [], future: [] }),
  updateCell: (row, col, value) => {
    const { rows, history } = get()
    set({ history: [...history, rows], future: [], rows: rows.map((r, i) => (i === row ? { ...r, [col]: value } : r)) })
  },
  undo: () => {
    const { history, rows, future } = get()
    if (!history.length) return
    const prev = history[history.length - 1]
    set({ rows: prev, history: history.slice(0, -1), future: [rows, ...future] })
  },
  redo: () => {
    const { history, rows, future } = get()
    if (!future.length) return
    const next = future[0]
    set({ rows: next, history: [...history, rows], future: future.slice(1) })
  },
  insertRow: (after) => {
    const { rows, columns, history } = get()
    const empty = Object.fromEntries(columns.map((c) => [c, '']))
    const next = [...rows.slice(0, after + 1), empty, ...rows.slice(after + 1)]
    set({ history: [...history, rows], future: [], rows: next })
  },
  deleteRow: (index) => {
    const { rows, history } = get()
    if (rows.length <= 1) return
    set({ history: [...history, rows], future: [], rows: rows.filter((_, i) => i !== index) })
  },
  insertColumn: (name) => {
    const { columns, rows, history } = get()
    let count = columns.length + 1
    let colName = name ?? `column_${count}`
    while (columns.includes(colName)) { count++; colName = `column_${count}` }
    set({
      history: [...history, rows],
      future: [],
      columns: [...columns, colName],
      rows: rows.map((r) => ({ ...r, [colName]: '' })),
    })
  },
}))
