import { useMemo } from 'react'
import type { Row } from '@/stores/dataStore'
import { formatNumber } from '@/lib/utils'

export function ProfilingPanel({ rows, columns }: { rows: Row[]; columns: string[] }) {
  const stats = useMemo(() => columns.map((k) => {
    const vals = rows.map((r) => r[k]).filter((v) => v !== null && v !== '')
    return { key: k, nulls: rows.length - vals.length, unique: new Set(vals).size }
  }), [rows, columns])
  const numeric = useMemo(() => columns.map((k) => {
    const vals = rows.map((r) => Number(r[k])).filter((v) => !Number.isNaN(v))
    return { key: k, count: vals.length, min: Math.min(...vals), max: Math.max(...vals), mean: vals.reduce((a,b)=>a+b,0)/(vals.length||1) }
  }).filter((x) => x.count > 0), [rows, columns])

  return (
    <aside className="w-[260px] shrink-0 border-l border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900 p-4 overflow-auto space-y-4">
      <div>
        <p className="text-[10px] tracking-widest text-zinc-400 font-semibold">DATA PROFILE</p>
        <h3 className="font-semibold text-sm mt-1">Dataset</h3>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs border rounded-md p-2 bg-white dark:bg-zinc-800">
          <div><b className="block">{rows.length}</b><span className="text-[9px] text-zinc-500">Rows</span></div>
          <div><b className="block">{columns.length}</b><span className="text-[9px] text-zinc-500">Cols</span></div>
          <div><b className="block">0</b><span className="text-[9px] text-zinc-500">Issues</span></div>
        </div>
      </div>
      <div>
        <h4 className="text-[10px] font-semibold text-zinc-500 uppercase">Column overview</h4>
        <div className="mt-2 space-y-1">
          {stats.slice(0,6).map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-xs py-1">
              <span className="w-5 h-5 grid place-items-center bg-indigo-50 dark:bg-zinc-700 rounded text-[10px]">#</span>
              <span className="flex-1 capitalize">{s.key}<small className="block text-[9px] text-zinc-400">{s.unique} unique · {s.nulls} null</small></span>
            </div>
          ))}
        </div>
      </div>
      {numeric[0] && (
        <div className="border-t pt-3">
          <h4 className="text-[10px] font-semibold text-zinc-500 uppercase">Numeric summary</h4>
          <p className="text-xs mt-2 flex justify-between"><span>{numeric[0].key}</span><b className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">avg {formatNumber(Math.round(numeric[0].mean))}</b></p>
          <p className="text-[10px] text-zinc-500 mt-1">Min {formatNumber(numeric[0].min)} · Max {formatNumber(numeric[0].max)}</p>
        </div>
      )}
    </aside>
  )
}
