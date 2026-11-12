import { colLetter } from '@/lib/utils'

export function FormulaBar({
  active, value, editing, draft, onChange, onCommit,
}: {
  active: { row: number; col: number }
  value: unknown
  editing: boolean
  draft: string
  onChange: (v: string) => void
  onCommit: (v: string) => void
}) {
  return (
    <div className="h-[35px] flex items-center border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="w-[71px] h-full grid place-items-center border-r border-zinc-200 dark:border-zinc-700 text-[11px] font-mono text-zinc-600 dark:text-zinc-300">
        {colLetter(active.col)}{active.row + 1}
      </div>
      <div className="px-2 text-zinc-400 italic font-serif text-sm">fx</div>
      <input
        value={editing ? draft : String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onCommit((e.target as HTMLInputElement).value)}
        onFocus={() => onChange(String(value ?? ''))}
        className="flex-1 h-full outline-none px-2 font-mono text-[11px] bg-transparent text-zinc-800 dark:text-zinc-100"
      />
    </div>
  )
}
