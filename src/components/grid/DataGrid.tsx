// @ts-nocheck
import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table'
import { evaluateCell } from '@/lib/formula'
import { colLetter, formatNumber } from '@/lib/utils'
import type { Row } from '@/stores/dataStore'

type Props = {
  rows: Row[]
  columns: string[]
  active: { row: number; col: number }
  editing: boolean
  draft: string
  onSelect: (row: number, col: number) => void
  onDraft: (v: string) => void
  onCommit: (v: string) => void
  onStartEdit: () => void
}

export function DataGrid({ rows, columns, active, editing, draft, onSelect, onDraft, onCommit, onStartEdit }: Props) {
  const helper = createColumnHelper<Row>()
  const cols = useMemo(
    () =>
      columns.map((key, idx) =>
        helper.accessor((row: Row) => row[key], {
          id: key,
          header: () => (
            <span className="flex flex-col">
              <span className="text-[9px] text-zinc-400 uppercase">{colLetter(idx)}</span>
              <span className="font-semibold text-zinc-600 dark:text-zinc-300 capitalize">{key.replace('_', ' ')}</span>
            </span>
          ),
          cell: (info) => {
            const ri = info.row.index
            const ci = idx
            const selected = active.row === ri && active.col === ci
            const raw = info.getValue()
            const computed = String(raw).startsWith('=') ? evaluateCell(String(raw), rows, columns, ri, ci) : formatNumber(raw)
            const isSelectedEditing = selected && editing
            return (
              <div
                className={selected ? 'outline outline-2 outline-emerald-600 -outline-offset-2 bg-emerald-50/60 dark:bg-emerald-900/20' : ''}
                onClick={() => onSelect(ri, ci)}
                onDoubleClick={() => { onSelect(ri, ci); onStartEdit() }}
              >
                {isSelectedEditing ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => onDraft(e.target.value)}
                    onBlur={() => onCommit(draft)}
                    onKeyDown={(e) => e.key === 'Enter' && onCommit(draft)}
                    className="w-full h-full px-2 py-1 text-[11px] font-mono outline-none"
                  />
                ) : (
                  <span className={String(raw).startsWith('=') ? 'font-mono text-[11px]' : 'text-[11px]'}>{computed}</span>
                )}
              </div>
            )
          },
        })
      ),
    [columns, rows, active, editing, draft, onSelect, onDraft, onCommit, onStartEdit, helper]
  )

  const table = useReactTable({ data: rows, columns: cols, getCoreRowModel: getCoreRowModel() })
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 12,
  })

  return (
    <div ref={parentRef} className="flex-1 min-w-0 min-h-0 overflow-auto bg-white dark:bg-zinc-900">
      <div className="min-w-[1100px]">
        <div className="sticky top-0 z-10 flex bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-[11px]">
          <div className="w-[42px] shrink-0 border-r bg-zinc-50 dark:bg-zinc-800" />
          {table.getHeaderGroups()[0]?.headers.map((h) => (
            <div key={h.id} className="flex-1 min-w-[140px] px-2 py-2 border-r border-zinc-200 dark:border-zinc-700">
              {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
            </div>
          ))}
        </div>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((v) => {
            const row = table.getRowModel().rows[v.index]
            return (
              <div
                key={row.id}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${v.start}px)` }}
                className="flex h-[34px] border-b border-zinc-100 dark:border-zinc-800"
              >
                <div className="w-[42px] shrink-0 grid place-items-center text-[10px] text-zinc-400 border-r bg-zinc-50 dark:bg-zinc-800">{v.index + 1}</div>
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className="flex-1 min-w-[140px] px-2 py-1 border-r border-zinc-100 dark:border-zinc-800 truncate">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
