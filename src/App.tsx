import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, ChevronDown, ChevronRight, CircleHelp, Clock3, Code2, Database,
  Download, FileSpreadsheet, FolderOpen, Grid2X2, Moon, MoreHorizontal, Play,
  Plus, Redo2, Search, Settings2, Sparkles, Sun, Table2, Undo2, Upload,
  X
} from 'lucide-react'
import { parseFile, exportCsv as exportCsvLib, exportXlsx } from '@/lib/fileParsers'
import { evaluateCell } from '@/lib/formula'
import { executeLocalQuery } from '@/lib/localQuery'
import { createHttpSyncProvider } from '@/lib/sync'

type Row = Record<string, string | number | null>
type ActiveCell = { row: number; col: number }
type CellStyle = { bold?: boolean; italic?: boolean; text?: boolean }
type WorkspaceTab = { id: string; name: string; rows: Row[]; columns: string[] }
type PipelineStep = { operation: 'trim' | 'uppercase' | 'lowercase' | 'number'; column: string }

const seedRows: Row[] = [
  { order_id: 'ORD-1001', customer: 'Alya Pratama', region: 'Jakarta', category: 'Electronics', units: 2, revenue: 12500000, date: '2025-01-04', status: 'Completed' },
  { order_id: 'ORD-1002', customer: 'Rizky Maulana', region: 'Bandung', category: 'Home & Living', units: 1, revenue: 890000, date: '2025-01-04', status: 'Completed' },
  { order_id: 'ORD-1003', customer: 'Nadia Lestari', region: 'Surabaya', category: 'Electronics', units: 3, revenue: 7600000, date: '2025-01-05', status: 'Processing' },
  { order_id: 'ORD-1004', customer: 'Bima Saputra', region: 'Jakarta', category: 'Fashion', units: 4, revenue: 1400000, date: '2025-01-06', status: 'Completed' },
  { order_id: 'ORD-1005', customer: 'Citra Dewi', region: 'Yogyakarta', category: 'Beauty', units: 2, revenue: 580000, date: '2025-01-06', status: 'Completed' },
  { order_id: 'ORD-1006', customer: 'Dimas Wibowo', region: 'Bandung', category: 'Electronics', units: 1, revenue: 4200000, date: '2025-01-07', status: 'Pending' },
  { order_id: 'ORD-1007', customer: 'Salsa Maharani', region: 'Jakarta', category: 'Home & Living', units: 5, revenue: 2150000, date: '2025-01-07', status: 'Completed' },
  { order_id: 'ORD-1008', customer: 'Farhan Akbar', region: 'Medan', category: 'Fashion', units: 2, revenue: 970000, date: '2025-01-08', status: 'Processing' },
  { order_id: 'ORD-1009', customer: 'Putri Ananda', region: 'Surabaya', category: 'Beauty', units: 3, revenue: 1320000, date: '2025-01-08', status: 'Completed' },
  { order_id: 'ORD-1010', customer: 'Rangga Putra', region: 'Jakarta', category: 'Electronics', units: 1, revenue: 6850000, date: '2025-01-09', status: 'Completed' },
  { order_id: 'ORD-1011', customer: 'Maya Sari', region: 'Bandung', category: 'Home & Living', units: 2, revenue: 1790000, date: '2025-01-10', status: 'Pending' },
  { order_id: 'ORD-1012', customer: 'Dion Prakoso', region: 'Yogyakarta', category: 'Electronics', units: 1, revenue: 3490000, date: '2025-01-10', status: 'Completed' },
]
const initialCols = ['order_id', 'customer', 'region', 'category', 'units', 'revenue', 'date', 'status']
const formatNumber = (value: unknown) => typeof value === 'number' ? new Intl.NumberFormat('id-ID').format(value) : String(value ?? '')
const colLetter = (index: number) => {
  let s = ''; let n = index
  while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1 }
  return s
}
const sqlName = (name: string, fallback: string) => name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^\d/, '_$&') || fallback
const pieGradient = (values: Array<{ share: number }>) => {
  const colors = ['#4f9d8b', '#e4a84d', '#6d83c2', '#cc6f8f', '#8d70b0', '#5ba5b5', '#c47b55', '#7c9c63']
  let start = 0
  return `conic-gradient(${values.map((item, index) => { const end = start + item.share; const segment = `${colors[index % colors.length]} ${start}% ${end}%`; start = end; return segment }).join(', ')})`
}

const parseCsvLine = (line: string) => {
  const values: string[] = []; let value = ''; let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"' && line[i + 1] === '"') { value += '"'; i++ }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { values.push(value.trim()); value = '' }
    else value += char
  }
  values.push(value.trim()); return values
}

function formulaValue(input: string, rows: Row[], columns: string[]) {
  // Delegates to HyperFormula wrapper (lib/formula.ts) with legacy fallback inside.
  const idx = columns.findIndex((_, i) => input.includes(colLetter(i)))
  // Use evaluateCell for any cell; row/col not critical for stateless eval
  return evaluateCell(input, rows, columns, 0, 0)
}

function App() {
  const [mode, setMode] = useState<'sheet' | 'sql'>('sheet')
  const [rows, setRows] = useState<Row[]>(seedRows)
  const [columns, setColumns] = useState(initialCols)
  const [tabs, setTabs] = useState<WorkspaceTab[]>([{ id: 'sample', name: 'sales_data.csv', rows: seedRows, columns: initialCols }])
  const [activeTabId, setActiveTabId] = useState('sample')
  const [pipeline, setPipeline] = useState<PipelineStep[]>([])
  const [active, setActive] = useState<ActiveCell>({ row: 0, col: 0 })
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({})
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('ORD-1001')
  const [history, setHistory] = useState<Row[][]>([])
  const [future, setFuture] = useState<Row[][]>([])
  const [dark, setDark] = useState(false)
  const [query, setQuery] = useState('SELECT\n  region,\n  COUNT(*) AS orders,\n  SUM(revenue) AS total_revenue\nFROM sales\nGROUP BY region\nORDER BY total_revenue DESC;')
  const [queryRows, setQueryRows] = useState<Row[]>([])
  const [hasRun, setHasRun] = useState(false)
  const [queryError, setQueryError] = useState('')
  const [queryHistory, setQueryHistory] = useState<Array<{ sql: string; label: string; rows: number }>>([])
  const [showPalette, setShowPalette] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [showCleanMenu, setShowCleanMenu] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [chartDimension, setChartDimension] = useState('region')
  const [chartMetric, setChartMetric] = useState('revenue')
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'table'>('bar')
  const [sqliteTables, setSqliteTables] = useState<Array<{ name: string; rows: number }>>([])
  const [toast, setToast] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [nativeFile, setNativeFile] = useState<{ path: string; offset: number; totalRows: number } | null>(null)
  const [sourcePath, setSourcePath] = useState<string | null>(null)
  const [syncBaseVersion, setSyncBaseVersion] = useState(0)
  const [restored, setRestored] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const runQueryRef = useRef<() => void>(() => {})
  const activeKey = columns[active.col]
  const activeStyleKey = `${active.row}:${active.col}`
  const activeStyle = cellStyles[activeStyleKey] ?? {}
  const activeRaw = rows[active.row]?.[activeKey] ?? ''
  const computed = String(activeRaw).startsWith('=') ? formulaValue(String(activeRaw), rows, columns) : activeRaw

  const totals = useMemo(() => ({
    records: rows.length,
    revenue: rows.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0),
    avg: rows.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0) / (rows.length || 1)
  }), [rows])
  const profile = useMemo(() => columns.map(key => {
    const values = rows.map(r => r[key]).filter(v => v !== null && v !== '')
    return { key, nulls: rows.length - values.length, unique: new Set(values).size }
  }), [columns, rows])
  const qualityIssues = useMemo(() => {
    const emptyCells = rows.reduce((count, row) => count + columns.filter(column => row[column] === null || row[column] === '').length, 0)
    const signatures = rows.map(row => JSON.stringify(columns.map(column => row[column] ?? null)))
    const duplicateRows = signatures.length - new Set(signatures).size
    return { emptyCells, duplicateRows, total: emptyCells + duplicateRows }
  }, [columns, rows])
  const numericProfile = useMemo(() => columns.map(key => {
    const values = rows.map(row => Number(row[key])).filter(value => !Number.isNaN(value))
    return { key, count: values.length, min: Math.min(...values), max: Math.max(...values), mean: values.reduce((sum, value) => sum + value, 0) / (values.length || 1) }
  }).filter(item => item.count > 0), [columns, rows])
  const chartColumns = useMemo(() => ({ dimensions: columns.filter(column => rows.some(row => typeof row[column] === 'string' || (row[column] !== null && row[column] !== undefined))), metrics: columns.filter(column => rows.some(row => typeof row[column] === 'number' || (row[column] !== null && row[column] !== '' && Number.isFinite(Number(row[column]))))) }), [columns, rows])
  const chartData = useMemo(() => {
    const dimension = chartColumns.dimensions.includes(chartDimension) ? chartDimension : chartColumns.dimensions[0]
    const metric = chartColumns.metrics.includes(chartMetric) ? chartMetric : chartColumns.metrics[0]
    const grouped = rows.reduce<Record<string, number>>((acc, row) => { const key = String(row[dimension] ?? 'Other'); acc[key] = (acc[key] ?? 0) + (Number(row[metric]) || 0); return acc }, {})
    const values = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 8)
    const max = Math.max(...values.map(([, value]) => value), 1)
    const total = values.reduce((sum, [, value]) => sum + value, 0) || 1
    return { dimension, metric, values: values.map(([label, value]) => ({ label, value, percent: Math.round(value / max * 100), share: Math.round(value / total * 100) })) }
  }, [rows, chartColumns, chartDimension, chartMetric])
  const sqlSources = useMemo(() => {
    const used = new Set<string>()
    return tabs.map((tab, index) => {
      const base = tab.id === activeTabId ? 'sales' : sqlName(tab.name, `table_${index + 1}`)
      let name = base; let suffix = 2
      while (used.has(name)) name = `${base}_${suffix++}`
      used.add(name)
      return { name, rows: tab.rows, columns: tab.columns }
    })
  }, [tabs, activeTabId])
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dataforge.session.v1')
      if (saved) {
        const state = JSON.parse(saved) as { rows?: Row[]; columns?: string[]; tabs?: WorkspaceTab[]; activeTabId?: string; pipeline?: PipelineStep[]; mode?: 'sheet' | 'sql'; dark?: boolean; cellStyles?: Record<string, CellStyle> }
        if (state.rows?.length && state.columns?.length) { setRows(state.rows); setColumns(state.columns) }
        if (state.tabs?.length) { setTabs(state.tabs); setActiveTabId(state.activeTabId ?? state.tabs[0].id) }
        if (state.pipeline) setPipeline(state.pipeline)
        if (state.mode) setMode(state.mode)
        if (typeof state.dark === 'boolean') setDark(state.dark)
        if (state.cellStyles) setCellStyles(state.cellStyles)
      }
    } catch { /* Ignore malformed sessions. */ }
    setRestored(true)
  }, [])
  useEffect(() => {
    if (restored) localStorage.setItem('dataforge.session.v1', JSON.stringify({ rows, columns, tabs, activeTabId, pipeline, mode, dark, cellStyles }))
  }, [rows, columns, tabs, activeTabId, pipeline, mode, dark, cellStyles, restored])
  useEffect(() => {
    setTabs(current => current.map(tab => tab.id === activeTabId ? { ...tab, rows, columns } : tab))
  }, [rows, columns, activeTabId])
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.sheet-grid tbody td span').forEach((element) => {
      element.style.fontWeight = ''
      element.style.fontStyle = ''
      element.style.fontFamily = ''
    })
    Object.entries(cellStyles).forEach(([key, style]) => {
      const [row, col] = key.split(':').map(Number)
      const element = document.querySelector<HTMLElement>(`.sheet-grid tbody tr:nth-child(${row + 1}) td:nth-child(${col + 1}) span`)
      if (!element) return
      if (style.bold) element.style.fontWeight = '700'
      if (style.italic) element.style.fontStyle = 'italic'
      if (style.text) element.style.fontFamily = 'DM Mono, monospace'
    })
  }, [cellStyles, rows, columns, filterText, sortDirection])
  useEffect(() => {
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'k') { event.preventDefault(); setShowPalette(true) }
      if (meta && event.key.toLowerCase() === 'o') { event.preventDefault(); fileRef.current?.click() }
      if (meta && event.key === '1') { event.preventDefault(); setMode('sheet') }
      if (meta && event.key === '2') { event.preventDefault(); setMode('sql') }
      if (meta && event.key === 'Enter' && mode === 'sql') { event.preventDefault(); runQueryRef.current() }
      if (meta && event.key.toLowerCase() === 'b' && mode === 'sheet') { event.preventDefault(); toggleCellStyle('bold') }
      if (meta && event.key.toLowerCase() === 'i' && mode === 'sheet') { event.preventDefault(); toggleCellStyle('italic') }
      if (event.key === 'Escape') { setShowPalette(false); setFilterOpen(false); setEditing(false) }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [mode])
  const visibleRows = useMemo(() => {
    const matches = rows.map((row, index) => ({ row, index })).filter(({ row }) => !filterText || Object.values(row).some(value => String(value ?? '').toLowerCase().includes(filterText.toLowerCase())))
    if (!sortDirection) return matches
    return [...matches].sort((a, b) => {
      const left = a.row[activeKey] ?? ''; const right = b.row[activeKey] ?? ''
      const compared = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'id')
      return sortDirection === 'asc' ? compared : -compared
    })
  }, [rows, filterText, sortDirection, activeKey])
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }
  const openWorkspaceTab = (name: string, nextRows: Row[], nextColumns: string[]) => {
    const id = `${name}-${Date.now()}`
    setTabs(current => [...current, { id, name, rows: nextRows, columns: nextColumns }])
    setActiveTabId(id); setRows(nextRows); setColumns(nextColumns); setActive({ row: 0, col: 0 }); setHistory([]); setFuture([])
  }
  const selectWorkspaceTab = (id: string) => {
    const tab = tabs.find(item => item.id === id)
    if (!tab) return
    setActiveTabId(id); setRows(tab.rows); setColumns(tab.columns); setActive({ row: 0, col: 0 }); setHistory([]); setFuture([]); setFilterText(''); setSortDirection(null)
  }
  const closeWorkspaceTab = (id: string) => {
    if (tabs.length === 1) return
    const remaining = tabs.filter(tab => tab.id !== id)
    const nextId = id === activeTabId ? remaining[0].id : activeTabId
    setTabs(remaining)
    if (id === activeTabId) {
      const next = remaining.find(tab => tab.id === nextId)!
      setActiveTabId(next.id); setRows(next.rows); setColumns(next.columns); setActive({ row: 0, col: 0 })
    }
  }
  const toggleCellStyle = (property: keyof CellStyle) => {
    setCellStyles(styles => ({ ...styles, [activeStyleKey]: { ...styles[activeStyleKey], [property]: !styles[activeStyleKey]?.[property] } }))
  }

  const updateCell = (value: string) => {
    setHistory(h => [...h, rows]); setFuture([])
    setRows(old => old.map((row, i) => i === active.row ? { ...row, [activeKey]: value } : row))
    setEditing(false)
  }
  const move = (row: number, col: number) => {
    setEditing(false); setActive({ row: Math.max(0, Math.min(rows.length - 1, row)), col: Math.max(0, Math.min(columns.length - 1, col)) })
  }
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return
    if (event.key === 'ArrowDown') { event.preventDefault(); move(active.row + 1, active.col) }
    if (event.key === 'ArrowUp') { event.preventDefault(); move(active.row - 1, active.col) }
    if (event.key === 'ArrowRight') { event.preventDefault(); move(active.row, active.col + 1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(active.row, active.col - 1) }
    if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); setDraft(String(activeRaw)); setEditing(true) }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') undo()
  }
  const undo = () => setHistory(h => { if (!h.length) return h; const previous = h[h.length - 1]; setFuture(f => [rows, ...f]); setRows(previous); return h.slice(0, -1) })
  const redo = () => setFuture(f => { if (!f.length) return f; const next = f[0]; setHistory(h => [...h, rows]); setRows(next); return f.slice(1) })
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    try {
      // Prefer the robust PapaParse + ExcelJS parser in lib/fileParsers.ts
      if ((file.name.toLowerCase().endsWith('.parquet') || file.name.toLowerCase().endsWith('.sqlite') || file.name.toLowerCase().endsWith('.db')) && '__TAURI_INTERNALS__' in window) {
        const { invoke } = await import('@tauri-apps/api/core')
        const command = file.name.toLowerCase().endsWith('.sqlite') || file.name.toLowerCase().endsWith('.db') ? 'preview_sqlite' : 'preview_file'
        const path = (file as File & { path?: string }).path ?? file.name
        const preview = await invoke<{ columns: string[]; rows: Row[]; totalRows: number }>(command, { request: { path, limit: 500, offset: 0 } })
        if (preview.rows.length) { openWorkspaceTab(file.name, preview.rows, preview.columns); setNativeFile({ path, offset: preview.rows.length, totalRows: preview.totalRows }); setSourcePath(path); notify(`${file.name} preview native (${preview.totalRows} total)`) ; return }
      }
      const { rows: parsed, columns: cols } = await parseFile(file)
      if (parsed.length) { openWorkspaceTab(file.name, parsed, cols); setNativeFile(null); setSourcePath(null); notify(`${file.name} imported via PapaParse/ExcelJS`) }
      else throw new Error('empty')
    } catch (e) {
      console.error(e)
      window.alert('File tidak dapat dibaca. Gunakan CSV, Excel, JSON, JSON Lines, SQLite/DB, atau Parquet (Tauri).')
    } finally { event.target.value = '' }
  }
  const loadMoreNativeRows = async () => {
    if (!nativeFile || nativeFile.offset >= nativeFile.totalRows || !('__TAURI_INTERNALS__' in window)) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const command = nativeFile.path.toLowerCase().endsWith('.sqlite') || nativeFile.path.toLowerCase().endsWith('.db') ? 'preview_sqlite' : 'preview_file'
      const page = await invoke<{ rows: Row[] }>(command, { request: { path: nativeFile.path, limit: 500, offset: nativeFile.offset } })
      setRows(current => [...current, ...page.rows])
      setNativeFile(current => current ? { ...current, offset: current.offset + page.rows.length } : current)
      notify(`${page.rows.length} rows loaded`)
    } catch { notify('Could not load the next native data page') }
  }
  const openCatalog = async () => {
    if (!sourcePath || !/\.(sqlite|db)$/i.test(sourcePath) || !('__TAURI_INTERNALS__' in window)) {
      setMode('sql'); notify('Open a SQLite file first to browse its tables'); return
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const tables = await invoke<Array<{ name: string; rows: number }>>('list_sqlite_tables', { path: sourcePath })
      setSqliteTables(tables); setShowCatalog(true)
    } catch { notify('Could not read the SQLite catalog') }
  }
  const selectSqliteTable = async (table: string) => {
    if (!sourcePath) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const preview = await invoke<{ columns: string[]; rows: Row[]; totalRows: number }>('preview_sqlite', { request: { path: sourcePath, table, limit: 500, offset: 0 } })
      setRows(preview.rows); setColumns(preview.columns); setNativeFile({ path: sourcePath, offset: preview.rows.length, totalRows: preview.totalRows }); setActive({ row: 0, col: 0 }); setHistory([]); setFuture([]); setShowCatalog(false); notify(`Opened SQLite table ${table}`)
    } catch { notify(`Could not open SQLite table ${table}`) }
  }
  const runQuery = async () => {
    setQueryError('')
    const saveQuery = (count: number) => {
      const label = query.replace(/\s+/g, ' ').trim().slice(0, 44) || 'Untitled query'
      setQueryHistory(items => [{ sql: query, label, rows: count }, ...items.filter(item => item.sql !== query)].slice(0, 8))
    }
    // In the browser preview this falls back to the local demo engine. In Tauri,
    // the same UI can call the native DuckDB command without changing the view.
    if ('__TAURI_INTERNALS__' in window) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const isSqlite = sourcePath && /\.(sqlite|db)$/i.test(sourcePath)
        const command = isSqlite ? 'query_sqlite' : 'query_duckdb'
        const safePath = sourcePath?.replaceAll("'", "''")
        const extension = sourcePath?.split('.').pop()?.toLowerCase()
        const reader = extension === 'parquet' ? `read_parquet('${safePath}')` : extension === 'json' || extension === 'jsonl' || extension === 'ndjson' ? `read_json_auto('${safePath}')` : `read_csv_auto('${safePath}', header=true)`
        const nativeSql = sourcePath && !isSqlite ? query.replace(/\bfrom\s+sales\b/i, `FROM ${reader}`) : query
        const result = await invoke<{ columns: string[]; rows: Record<string, string>[] }>(command, { request: { sql: nativeSql, ...(isSqlite ? { databasePath: sourcePath } : {}) } })
        if (result.rows.length) { setQueryRows(result.rows); setHasRun(true); saveQuery(result.rows.length); notify(`${result.rows.length} rows returned from native DuckDB`); return }
      } catch {
        notify('Native query failed; using local preview data')
      }
    }
    if (!('__TAURI_INTERNALS__' in window)) {
      try {
        const { executeBrowserSql } = await import('@/lib/browserSql')
        const browserResult = await executeBrowserSql(sqlSources, query)
        setQueryRows(browserResult); setHasRun(true); saveQuery(browserResult.length); notify(`${browserResult.length} rows returned from DuckDB-WASM`); return
      } catch { notify('DuckDB-WASM unavailable; using local SQL fallback') }
    }
    try {
      const result = executeLocalQuery(query, rows)
      setQueryRows(result); setHasRun(true); saveQuery(result.length); notify(`${result.length} rows returned from local.duckdb`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query tidak dapat dijalankan'
      setQueryError(message)
      setHasRun(false)
      notify('Query gagal dijalankan')
    }
  }
  runQueryRef.current = () => { void runQuery() }
  const exportCsv = async (source: Row[] = rows) => {
    const cols = source.length ? Object.keys(source[0]) : columns
    if ('__TAURI_INTERNALS__' in window) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog')
        const path = await save({ defaultPath: 'dataforge-export.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] })
        if (!path) return
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('export_rows', { request: { path, columns: cols, rows: source, format: 'csv' } })
        notify('CSV saved to the selected location')
        return
      } catch { notify('Native export failed; using browser download') }
    }
    try { exportCsvLib(source, cols, 'dataforge-export.csv'); notify('CSV export via PapaParse') } catch {
      const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
      const blob = new Blob([[cols.join(','), ...source.map(r => cols.map(k => escape(r[k])).join(','))].join('\n')], { type: 'text/csv' })
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'dataforge-export.csv'; link.click(); URL.revokeObjectURL(link.href); notify('CSV export has started')
    }
  }
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'dataforge-export.json'; link.click(); URL.revokeObjectURL(link.href); notify('JSON export has started')
  }
  const exportAllTabs = () => {
    const payload = Object.fromEntries(tabs.map(tab => [tab.name, tab.rows]))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'dataforge-tabs.json'; link.click(); URL.revokeObjectURL(link.href); notify('All tabs exported as JSON')
  }
  const shareWorkspace = async () => {
    const snapshot = { id: activeTabId, version: syncBaseVersion + 1, baseVersion: syncBaseVersion, updatedAt: new Date().toISOString(), rows, columns }
    const syncUrl = import.meta.env.VITE_DATAFORGE_SYNC_URL as string | undefined
    try {
      if (syncUrl) {
        await createHttpSyncProvider(syncUrl, import.meta.env.VITE_DATAFORGE_SYNC_TOKEN as string | undefined).save(snapshot)
        setSyncBaseVersion(snapshot.version)
        notify('Workspace synced to the configured server')
      } else {
        await navigator.clipboard.writeText(JSON.stringify(snapshot))
        notify('Workspace snapshot copied; configure VITE_DATAFORGE_SYNC_URL for cloud sync')
      }
    } catch (error) { notify(error instanceof Error ? error.message : 'Workspace sync failed') }
  }
  const loadWorkspace = async () => {
    const syncUrl = import.meta.env.VITE_DATAFORGE_SYNC_URL as string | undefined
    if (!syncUrl) { notify('Configure VITE_DATAFORGE_SYNC_URL to load a shared workspace'); return }
    try {
      const snapshot = await createHttpSyncProvider(syncUrl, import.meta.env.VITE_DATAFORGE_SYNC_TOKEN as string | undefined).load(activeTabId)
      if (!snapshot) { notify('No shared snapshot exists for this workspace'); return }
      setRows(snapshot.rows); setColumns(snapshot.columns); setSyncBaseVersion(snapshot.version)
      setTabs(current => current.map(tab => tab.id === activeTabId ? { ...tab, rows: snapshot.rows, columns: snapshot.columns } : tab))
      setHistory([]); setFuture([]); setPipeline([]); setActive({ row: 0, col: 0 }); notify(`Loaded shared workspace v${snapshot.version}`)
    } catch { notify('Workspace load failed') }
  }
  const exportExcel = async () => { try { await exportXlsx(rows, 'dataforge-export.xlsx'); notify('Excel export via ExcelJS') } catch { notify('Excel export failed') } }
  const resetSession = () => {
    localStorage.removeItem('dataforge.session.v1')
    setRows(seedRows); setColumns(initialCols); setTabs([{ id: 'sample', name: 'sales_data.csv', rows: seedRows, columns: initialCols }]); setActiveTabId('sample'); setSyncBaseVersion(0); setPipeline([]); setNativeFile(null); setSourcePath(null); setActive({ row: 0, col: 0 }); setHistory([]); setFuture([]); setFilterText(''); setSortDirection(null); notify('Workspace reset to sample data')
  }
  const openQueryAsSheet = () => {
    if (!queryRows.length) { notify('Run a query before opening its results as a sheet'); return }
    setRows(queryRows); setColumns(Object.keys(queryRows[0])); setActive({ row: 0, col: 0 }); setHistory([]); setFuture([]); setMode('sheet'); notify('Query results opened as a new spreadsheet view')
  }
  const toggleSort = () => {
    const next = sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc'
    setSortDirection(next)
    notify(next ? `Sorted ${activeKey.replace('_', ' ')} ${next === 'asc' ? 'A–Z' : 'Z–A'}` : 'Sorting cleared')
  }
  const addRow = () => {
    const empty = Object.fromEntries(columns.map(column => [column, '']))
    setHistory(history => [...history, rows]); setFuture([])
    setRows(current => [...current.slice(0, active.row + 1), empty, ...current.slice(active.row + 1)])
    setActive(cell => ({ ...cell, row: cell.row + 1 })); notify('Blank row inserted')
  }
  const deleteRow = () => {
    if (rows.length <= 1) { notify('A sheet must keep at least one row'); return }
    setHistory(history => [...history, rows]); setFuture([])
    setRows(current => current.filter((_, index) => index !== active.row))
    setActive(cell => ({ ...cell, row: Math.max(0, Math.min(cell.row, rows.length - 2)) })); notify('Selected row deleted')
  }
  const removeEmptyRows = () => {
    const cleaned = rows.filter(row => columns.some(column => String(row[column] ?? '').trim() !== ''))
    if (cleaned.length === rows.length) { notify('No empty rows found'); return }
    setHistory(history => [...history, rows]); setFuture([]); setRows(cleaned); setActive(cell => ({ ...cell, row: Math.min(cell.row, Math.max(0, cleaned.length - 1)) })); notify(`${rows.length - cleaned.length} empty rows removed`)
  }
  const removeDuplicateRows = () => {
    const seen = new Set<string>(); const unique = rows.filter(row => { const key = JSON.stringify(columns.map(column => row[column] ?? null)); if (seen.has(key)) return false; seen.add(key); return true })
    if (unique.length === rows.length) { notify('No duplicate rows found'); return }
    setHistory(history => [...history, rows]); setFuture([]); setRows(unique); setActive(cell => ({ ...cell, row: Math.min(cell.row, Math.max(0, unique.length - 1)) })); notify(`${rows.length - unique.length} duplicate rows removed`)
  }
  const fillEmptyCells = () => {
    const value = window.prompt('Value to use for empty cells', '—')
    if (value === null) return
    const changed = rows.map(row => Object.fromEntries(columns.map(column => [column, row[column] === null || row[column] === '' ? value : row[column]]))) as Row[]
    setHistory(history => [...history, rows]); setFuture([]); setRows(changed); notify('Empty cells filled')
  }
  const renameActiveColumn = () => {
    const current = activeKey; const next = window.prompt('New column name', current)
    if (!next || next === current || columns.includes(next)) return
    setHistory(history => [...history, rows]); setFuture([]); setColumns(columns.map(column => column === current ? next : column)); setRows(rows.map(row => { const copy = { ...row }; copy[next] = copy[current]; delete copy[current]; return copy })); notify(`Column renamed to ${next}`)
  }
  const joinWithTab = () => {
    const candidates = tabs.filter(tab => tab.id !== activeTabId)
    if (!candidates.length) { notify('Open another dataset tab before joining'); return }
    const choice = window.prompt(`Join with tab number:\n${candidates.map((tab, index) => `${index + 1}. ${tab.name}`).join('\n')}`, '1')
    const selected = candidates[Number(choice) - 1]
    if (!selected) return
    const key = window.prompt(`Join key column (available in both datasets)`, columns[0] ?? '')
    if (!key || !columns.includes(key) || !selected.columns.includes(key)) { notify(`Column ${key || '(empty)'} is not available in both tabs`); return }
    const rightColumns = selected.columns.filter(column => column !== key)
    const rightByKey = new Map(selected.rows.map(row => [String(row[key] ?? ''), row]))
    const mergedColumns = [...columns, ...rightColumns.map(column => columns.includes(column) ? `${column}_right` : column)]
    const mergedRows = rows.map(row => {
      const match = rightByKey.get(String(row[key] ?? ''))
      return { ...row, ...Object.fromEntries(rightColumns.map(column => [columns.includes(column) ? `${column}_right` : column, match?.[column] ?? ''])) }
    })
    setHistory(history => [...history, rows]); setFuture([]); setColumns(mergedColumns); setRows(mergedRows); notify(`Joined ${selected.name} by ${key}`)
  }
  const transformActiveColumn = (transform: (value: string) => string, label: string, operation?: PipelineStep['operation']) => {
    setHistory(history => [...history, rows]); setFuture([]); setRows(rows.map(row => ({ ...row, [activeKey]: transform(String(row[activeKey] ?? '')) })))
    if (operation) setPipeline(current => [...current, { operation, column: activeKey }])
    notify(label)
  }
  const replayPipeline = () => {
    if (!pipeline.length) { notify('Pipeline is empty'); return }
    setHistory(history => [...history, rows]); setFuture([])
    setRows(rows => pipeline.reduce((current, step) => current.map(row => ({ ...row, [step.column]: step.operation === 'trim' ? String(row[step.column] ?? '').trim() : step.operation === 'uppercase' ? String(row[step.column] ?? '').toUpperCase() : step.operation === 'lowercase' ? String(row[step.column] ?? '').toLowerCase() : (() => { const value = Number(String(row[step.column] ?? '').replace(/[^\d,.-]/g, '').replace(',', '.')); return Number.isFinite(value) ? String(value) : row[step.column] })() })), rows))
    notify(`${pipeline.length} pipeline steps replayed`)
  }
  const clearPipeline = () => { setPipeline([]); notify('Pipeline cleared') }
  const splitActiveColumn = () => {
    const delimiter = window.prompt('Delimiter to split on', ',')
    if (delimiter === null || delimiter === '') return
    const firstName = window.prompt('First column name', `${activeKey}_1`)
    const secondName = window.prompt('Second column name', `${activeKey}_2`)
    if (!firstName || !secondName || columns.includes(firstName) || columns.includes(secondName)) { notify('Column names must be new and non-empty'); return }
    const nextColumns = [...columns.filter(column => column !== activeKey), firstName, secondName]
    const nextRows = rows.map(row => { const parts = String(row[activeKey] ?? '').split(delimiter); const copy = { ...row }; delete copy[activeKey]; return { ...copy, [firstName]: parts[0]?.trim() ?? '', [secondName]: parts.slice(1).join(delimiter).trim() } })
    setHistory(history => [...history, rows]); setFuture([]); setColumns(nextColumns); setRows(nextRows); notify(`Split ${activeKey} into ${firstName} and ${secondName}`)
  }
  const convertActiveColumnToNumber = () => {
    transformActiveColumn(value => { const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.'); const number = Number(cleaned); return Number.isFinite(number) ? String(number) : value }, `Converted ${activeKey} to numbers`)
  }
  const createPivot = () => {
    if (!rows.length) { notify('No rows available for a pivot'); return }
    const groupColumn = window.prompt(`Group rows by column:\n${columns.join(', ')}`, columns.includes('region') ? 'region' : columns[0])
    if (!groupColumn || !columns.includes(groupColumn)) return
    const valueColumn = window.prompt(`Value column (leave blank for COUNT):\n${columns.join(', ')}`, columns.includes('revenue') ? 'revenue' : '')
    if (valueColumn && !columns.includes(valueColumn)) return
    const aggregate = valueColumn ? (window.prompt('Aggregation: SUM or COUNT', 'SUM') ?? 'SUM').toUpperCase() : 'COUNT'
    const grouped = new Map<string, { count: number; total: number }>()
    rows.forEach(row => { const key = String(row[groupColumn] ?? ''); const current = grouped.get(key) ?? { count: 0, total: 0 }; current.count += 1; current.total += Number(row[valueColumn ?? groupColumn]) || 0; grouped.set(key, current) })
    const result = [...grouped.entries()].map(([group, values]) => ({ [groupColumn]: group, [valueColumn ? `${aggregate.toLowerCase()}_${valueColumn}` : 'count']: aggregate === 'COUNT' ? values.count : values.total }))
    openWorkspaceTab(`pivot_${groupColumn}`, result, Object.keys(result[0] ?? { [groupColumn]: '', count: 0 }))
    notify(`Pivot created by ${groupColumn}`)
  }
  const addColumn = () => {
    let count = columns.length + 1; let name = `column_${count}`
    while (columns.includes(name)) { count++; name = `column_${count}` }
    setHistory(history => [...history, rows]); setFuture([]); setColumns(current => [...current, name]); setRows(current => current.map(row => ({ ...row, [name]: '' }))); notify(`${name} added`)
  }
  const copyCell = async () => {
    try { await navigator.clipboard.writeText(String(computed)); notify(`${colLetter(active.col)}${active.row + 1} copied`) }
    catch { notify('Copy is not available in this browser context') }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]; if (!file) return
    try {
      const { rows: parsed, columns: cols } = await parseFile(file)
      if (parsed.length) { setRows(parsed); setColumns(cols); setNativeFile(null); setActive({ row: 0, col: 0 }); setHistory([]); setFuture([]); notify(`${file.name} dropped & imported`) }
    } catch { notify('Drop failed: unsupported file') }
  }

  return <main className={dark ? 'app dark' : 'app'} onKeyDown={handleKey} tabIndex={0} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sparkles size={18}/></div><span>DataForge</span></div>
      <button className="new-btn" onClick={resetSession}><Plus size={17}/> New workspace</button>
      <nav>
        <p>WORKSPACE</p>
        <button className={mode === 'sheet' ? 'nav active' : 'nav'} onClick={() => setMode('sheet')}><Grid2X2 size={17}/> Spreadsheet <span>⌘1</span></button>
        <button className={mode === 'sql' ? 'nav active' : 'nav'} onClick={() => setMode('sql')}><Code2 size={17}/> SQL Studio <span>⌘2</span></button>
        <button className="nav" onClick={() => void openCatalog()}><Database size={17}/> Data catalog</button>
        <button className="nav" onClick={() => document.querySelector('.inspector')?.scrollIntoView({ behavior: 'smooth' })}><BarChart3 size={17}/> Profiling</button>
        <p className="nav-label">RECENT FILES</p>
        <button className="recent"><FileSpreadsheet size={16}/><span>sales_data.csv<small>12.4 MB · Today</small></span><MoreHorizontal size={16}/></button>
        <button className="recent"><Database size={16}/><span>customers.sqlite<small>8 tables · Yesterday</small></span><MoreHorizontal size={16}/></button>
      </nav>
      <div className="sidebar-bottom"><button className="nav"><Settings2 size={17}/> Preferences</button><div className="offline"><i/> Working offline</div><div className="user"><div>AK</div><span>Ahmad Khairan<small>Personal workspace</small></span><ChevronDown size={15}/></div></div>
    </aside>

    <section className="shell">
      <header className="topbar">
        <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={15}/><strong>{mode === 'sheet' ? 'sales_data.csv' : 'SQL Studio'}</strong></div>
        <div className="top-actions"><button className="quick-search" onClick={() => setShowPalette(true)}><Search size={15}/><span>Quick actions</span><kbd>⌘ K</kbd></button><button className="icon-btn" onClick={() => setDark(!dark)} title="Tema">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="icon-btn" title="Session tersimpan otomatis"><CircleHelp size={18}/></button><button className="share" onClick={() => void loadWorkspace()}>Load</button><button className="share" onClick={() => void shareWorkspace()}>Share</button></div>
      </header>
      <div className="tabbar">{tabs.map(tab => <button key={tab.id} className={tab.id === activeTabId ? 'file-tab active' : 'file-tab'} onClick={() => selectWorkspaceTab(tab.id)}><FileSpreadsheet size={15}/> {tab.name} <X size={14} onClick={event => { event.stopPropagation(); closeWorkspaceTab(tab.id) }}/></button>)}<button className="add-tab" onClick={() => fileRef.current?.click()}><Plus size={17}/></button></div>
      {mode === 'sheet' ? <>
        <div className="toolbar"><div className="tool-group"><button onClick={() => fileRef.current?.click()}><FolderOpen size={16}/> Open</button><button onClick={() => exportCsv()}><Download size={16}/> Export</button></div><i/><div className="tool-group"><button disabled={!history.length} onClick={undo}><Undo2 size={16}/></button><button disabled={!future.length} onClick={redo}><Redo2 size={16}/></button></div><i/><div className="tool-group"><button onClick={addRow}><Plus size={15}/> Row</button><button onClick={addColumn}><Plus size={15}/> Column</button><button onClick={deleteRow} title="Delete active row"><X size={15}/> Row</button></div><i/><div className="tool-group"><button><span className="format">T</span> Text <ChevronDown size={13}/></button><button><b>B</b></button><button><em>I</em></button></div><i/><div className="tool-group filter-wrap"><button className={filterText ? 'engaged' : ''} onClick={() => setFilterOpen(!filterOpen)}><Search size={16}/> Filter {filterText && <b className="count-dot">1</b>}</button><button className={sortDirection ? 'engaged' : ''} onClick={toggleSort}><Table2 size={16}/> Sort {sortDirection && <span className="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</button>{filterOpen && <div className="filter-popover"><div><Search size={14}/><input autoFocus value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Filter all columns…"/></div><p>Searches all values in this sheet</p>{filterText && <button onClick={() => { setFilterText(''); setFilterOpen(false) }}>Clear filter</button>}</div>}</div><div className="toolbar-right"><button onClick={copyCell}>Copy cell</button><button><Clock3 size={16}/> History</button></div></div>
        <div className="formula-row"><div className="name-box">{colLetter(active.col)}{active.row + 1}</div><div className="fx">fx</div><input value={editing ? draft : String(activeRaw)} onChange={e => { setDraft(e.target.value); setEditing(true) }} onKeyDown={e => { if (e.key === 'Enter') updateCell(draft); if (e.key === 'Escape') setEditing(false) }} onFocus={() => { setDraft(String(activeRaw)); setEditing(true) }} /></div>
        <div className="sheet-body">
          <div className="clean-tools"><button onClick={() => setShowCleanMenu(!showCleanMenu)}>Clean data</button><button onClick={() => setShowChart(true)}>Chart</button><button onClick={exportAllTabs}>Export tabs</button>{showCleanMenu && <div className="filter-popover clean-popover"><button onClick={removeEmptyRows}>Remove empty rows</button><button onClick={removeDuplicateRows}>Remove duplicate rows</button><button onClick={fillEmptyCells}>Fill empty cells</button><button onClick={renameActiveColumn}>Rename active column</button><button onClick={joinWithTab}>Join another tab</button><button onClick={createPivot}>Create pivot</button><button onClick={() => transformActiveColumn(value => value.trim(), `Trimmed ${activeKey}`, 'trim')}>Trim active column</button><button onClick={() => transformActiveColumn(value => value.toUpperCase(), `Uppercased ${activeKey}`, 'uppercase')}>Uppercase active column</button><button onClick={() => transformActiveColumn(value => value.toLowerCase(), `Lowercased ${activeKey}`, 'lowercase')}>Lowercase active column</button><button onClick={() => transformActiveColumn(value => { const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.'); const number = Number(cleaned); return Number.isFinite(number) ? String(number) : value }, `Converted ${activeKey} to numbers`, 'number')}>Convert active to number</button><button onClick={splitActiveColumn}>Split active column</button><button onClick={replayPipeline}>Replay pipeline ({pipeline.length})</button><button onClick={clearPipeline}>Clear pipeline</button></div>}</div>
          {nativeFile && nativeFile.offset < nativeFile.totalRows && <button className="load-more" onClick={loadMoreNativeRows}>Load next 500 rows ({nativeFile.offset.toLocaleString()} / {nativeFile.totalRows.toLocaleString()})</button>}
          <div className="grid-wrap"><table className="sheet-grid"><thead><tr><th className="corner"/><>{columns.map((col, i) => <th key={col} className={activeKey === col && sortDirection ? 'sorted-col' : ''}><span>{colLetter(i)}</span><strong>{col.replace('_', ' ')}</strong>{activeKey === col && sortDirection ? <b className="header-sort">{sortDirection === 'asc' ? '↑' : '↓'}</b> : <ChevronDown size={12}/>}</th>)}</></tr></thead><tbody>{visibleRows.map(({ row, index: ri }) => <tr key={ri}><th>{ri + 1}</th>{columns.map((col, ci) => { const selected = active.row === ri && active.col === ci; const raw = row[col]; const shown = String(raw).startsWith('=') ? formulaValue(String(raw), rows, columns) : formatNumber(raw); return <td key={col} className={selected ? 'selected' : ''} onClick={() => { setActive({ row: ri, col: ci }); setEditing(false) }} onDoubleClick={() => { setActive({ row: ri, col: ci }); setDraft(String(raw ?? '')); setEditing(true) }}>{selected && editing ? <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => updateCell(draft)} onKeyDown={e => { if (e.key === 'Enter') updateCell(draft) }} /> : <span className={col === 'status' ? `status ${String(raw).toLowerCase()}` : ''}>{shown}</span>}</td> })}</tr>)}</tbody></table>{!visibleRows.length && <div className="empty-grid"><Search size={19}/><b>No matching rows</b><span>Try a different filter or clear the current one.</span><button onClick={() => setFilterText('')}>Clear filter</button></div>}
          </div>
          <aside className="inspector"><div className="inspector-head"><div><span>DATA PROFILE</span><h3>sales_data.csv</h3></div><button><MoreHorizontal size={18}/></button></div><div className="dataset-stats"><div><strong>{totals.records}</strong><span>Rows</span></div><div><strong>{columns.length}</strong><span>Columns</span></div><div><strong>{qualityIssues.total}</strong><span>Issues</span></div></div><div className="metric-card"><div><span>REVENUE</span><b>Rp {formatNumber(totals.revenue)}</b></div><span className="metric-badge">+12.4%</span><div className="spark-bars"><i/><i/><i/><i/><i/><i/><i/></div><small>Compared with previous period</small></div><div className="profile-section"><h4>Column overview</h4>{profile.slice(0, 6).map(item => <div className="profile-item" key={item.key}><div className="column-icon">{item.key === 'revenue' || item.key === 'units' ? '#' : 'T'}</div><span>{item.key.replace('_', ' ')}<small>{item.unique} unique · {item.nulls} null</small></span><ChevronRight size={14}/></div>)}</div>{numericProfile.length > 0 && <div className="value-stats"><h4>Numeric summary</h4><div><span>Selected: {numericProfile[0].key}</span><b>avg {formatNumber(Math.round(numericProfile[0].mean))}</b></div><p>Min {formatNumber(numericProfile[0].min)} <i/> Max {formatNumber(numericProfile[0].max)}</p></div>}<div className="quality"><div><Sparkles size={15}/><span>Data quality</span></div><strong>{qualityIssues.total ? 'Needs attention' : 'Excellent'}</strong><p>{qualityIssues.total ? `${qualityIssues.emptyCells} empty cells · ${qualityIssues.duplicateRows} duplicate rows detected.` : 'No missing values or duplicate rows detected in this dataset.'}</p><div className="quality-track"><i style={{ width: `${Math.max(8, 100 - Math.min(92, qualityIssues.total))}%` }}/></div><button onClick={() => setShowCleanMenu(true)}>View cleaning tools <ChevronRight size={14}/></button></div></aside>
        </div>
        <footer className="statusbar"><span>{filterText ? 'Filter active' : 'Ready'}</span><span>•</span><span>{visibleRows.length.toLocaleString()}{filterText ? ` of ${rows.length.toLocaleString()}` : ''} rows × {columns.length} columns</span><span className="status-right">{activeKey} · {typeof computed === 'number' ? formatNumber(computed) : String(computed)} <span>100%</span></span></footer>
      </> : <div className="sql-layout"><div className="sql-main"><div className="sql-toolbar"><div><Database size={17}/><b>local.duckdb</b><ChevronDown size={14}/></div><button className="run" onClick={runQuery}><Play size={15} fill="currentColor"/> Run query <kbd>⌘↵</kbd></button></div><div className="editor-line"><span>1</span><textarea spellCheck="false" value={query} onChange={e => { setQuery(e.target.value); setQueryError('') }}/></div><div className="results-head"><div><b>Results</b><span>{hasRun ? `${queryRows.length} rows returned` : 'Run a query to see results'}</span></div><div><button onClick={() => exportCsv(queryRows)}><Download size={15}/> Export CSV</button><button onClick={openQueryAsSheet}><Grid2X2 size={15}/> Open as sheet</button></div></div>{queryError ? <div className="query-error"><Code2 size={25}/><b>Query tidak valid</b><p>{queryError}</p><small>Periksa nama tabel, kolom, atau sintaks SQL lalu coba lagi.</small></div> : hasRun ? <table className="result-table"><thead><tr>{Object.keys(queryRows[0] || {}).map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{queryRows.map((r,i) => <tr key={i}>{Object.entries(r).map(([key, v]) => <td key={key}>{formatNumber(v)}</td>)}</tr>)}</tbody></table> : <div className="empty-results"><Code2 size={26}/><p>Your query results will appear here</p></div>}</div><aside className="sql-sidebar"><div className="database-title"><Database size={18}/><b>Data sources</b><button><Plus size={17}/></button></div><div className="connection"><span className="connection-dot"/><div><b>local.duckdb</b><small>DuckDB · Connected</small></div><MoreHorizontal size={16}/></div><div className="tree"><p>TABLES</p>{sqlSources.map(source => <div key={source.name}><ChevronDown size={14}/><Table2 size={15}/><b>{source.name}</b><span>{source.rows.length}</span></div>)}{columns.map(c => <button key={c}><span>└</span>{c}<small>{c === 'revenue' || c === 'units' ? 'INTEGER' : 'VARCHAR'}</small></button>)}</div><div className="query-history"><p>QUERY HISTORY</p>{queryHistory.length ? queryHistory.map(item => <button key={item.sql} onClick={() => { setQuery(item.sql); notify('Query restored in editor') }}><Clock3 size={15}/><span>{item.label}<small>{item.rows} rows returned</small></span></button>) : <div className="history-empty">Run a query to save it here.</div>}</div></aside></div>}
      <input ref={fileRef} className="hidden" type="file" accept=".csv,.json,.jsonl,.ndjson,.xlsx,.xls,.parquet,.sqlite,.db" onChange={importFile}/>
    </section>
    {showCatalog && <div className="palette-backdrop" onClick={() => setShowCatalog(false)}><div className="command-palette" onClick={e => e.stopPropagation()}><div className="palette-input"><Database size={17}/><b>SQLite tables</b><button onClick={() => setShowCatalog(false)}><X size={15}/></button></div><p>DATA CATALOG</p>{sqliteTables.map(table => <button key={table.name} onClick={() => void selectSqliteTable(table.name)}><Table2 size={16}/><span>{table.name}<small>{table.rows.toLocaleString()} rows</small></span></button>)}</div></div>}
    {showChart && <div className="palette-backdrop" onClick={() => setShowChart(false)}><div className="command-palette" onClick={e => e.stopPropagation()}><div className="palette-input"><BarChart3 size={17}/><b>Chart builder</b><button onClick={() => setShowChart(false)}><X size={15}/></button></div><div className="chart-controls"><label>Dimension<select value={chartDimension} onChange={event => setChartDimension(event.target.value)}>{chartColumns.dimensions.map(column => <option key={column}>{column}</option>)}</select></label><label>Metric<select value={chartMetric} onChange={event => setChartMetric(event.target.value)}>{chartColumns.metrics.map(column => <option key={column}>{column}</option>)}</select></label><label>View<select value={chartType} onChange={event => setChartType(event.target.value as 'bar' | 'line' | 'pie' | 'table')}><option value="bar">Bars</option><option value="line">Line</option><option value="pie">Pie</option><option value="table">Table</option></select></label></div>{chartType === 'bar' && chartData.values.map(item => <div key={item.label} className="chart-row"><span>{item.label}</span><div><i style={{ width: `${item.percent}%` }} /></div><b>{formatNumber(item.value)}</b></div>)}{chartType === 'line' && <div className="chart-line"><svg viewBox="0 0 320 150" role="img" aria-label="Line chart">{chartData.values.length > 1 && <polyline points={chartData.values.map((item, index) => `${16 + index * (288 / Math.max(chartData.values.length - 1, 1))},${136 - item.percent * 1.15}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>}{chartData.values.map((item, index) => <circle key={item.label} cx={16 + index * (288 / Math.max(chartData.values.length - 1, 1))} cy={136 - item.percent * 1.15} r="4" fill="currentColor"><title>{item.label}: {formatNumber(item.value)}</title></circle>)}</svg><div>{chartData.values.map(item => <span key={item.label}>{item.label}<b>{formatNumber(item.value)}</b></span>)}</div></div>}{chartType === 'pie' && <div className="chart-pie"><div className="pie-ring" style={{ background: pieGradient(chartData.values) }} /><div className="pie-legend">{chartData.values.map((item, index) => <span key={item.label}><i className={`pie-dot dot-${index % 8}`} />{item.label}<b>{item.share}%</b></span>)}</div></div>}{chartType === 'table' && <table className="chart-table"><thead><tr><th>{chartData.dimension}</th><th>{chartData.metric}</th></tr></thead><tbody>{chartData.values.map(item => <tr key={item.label}><td>{item.label}</td><td>{formatNumber(item.value)}</td></tr>)}</tbody></table>}</div></div>}
    {toast && <div className="toast"><span>✓</span>{toast}<button onClick={() => setToast('')}><X size={14}/></button></div>}
    {showPalette && <div className="palette-backdrop" onClick={() => setShowPalette(false)}><div className="command-palette" onClick={e => e.stopPropagation()}><div className="palette-input"><Search size={17}/><input autoFocus placeholder="Search actions, files, or commands…"/><kbd>ESC</kbd></div><p>QUICK ACTIONS</p><button onClick={() => { fileRef.current?.click(); setShowPalette(false) }}><FolderOpen size={16}/><span>Open local file<small>Import CSV, Excel, JSON, or JSON Lines</small></span><kbd>⌘ O</kbd></button><button onClick={() => { setMode('sql'); setShowPalette(false) }}><Code2 size={16}/><span>Open SQL Studio<small>Explore data with local DuckDB</small></span><kbd>⌘ 2</kbd></button><button onClick={() => { exportJson(); setShowPalette(false) }}><Download size={16}/><span>Export as JSON<small>Download the active sheet as JSON</small></span></button><button onClick={() => { resetSession(); setShowPalette(false) }}><Clock3 size={16}/><span>Reset sample workspace<small>Discard saved local session</small></span></button><button onClick={() => { setDark(!dark); setShowPalette(false) }}><Moon size={16}/><span>Toggle appearance<small>Switch between light and dark mode</small></span></button></div></div>}
  </main>
}

export default App
