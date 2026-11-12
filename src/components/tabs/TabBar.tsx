import { FileSpreadsheet, Plus, X } from 'lucide-react'

export function TabBar({
  tabs, activeId, onSelect, onClose, onAdd,
}: {
  tabs: { id: string; name: string }[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onAdd: () => void
}) {
  return (
    <div className="h-[38px] bg-zinc-50 dark:bg-zinc-900 flex items-end gap-1 px-2 border-b border-zinc-200 dark:border-zinc-700">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={t.id === activeId ? 'h-[34px] bg-white dark:bg-zinc-800 border border-b-white rounded-t-md px-3 flex items-center gap-2 text-[11px]' : 'h-[30px] px-3 text-[11px] text-zinc-500 dark:text-zinc-400'}
        >
          <FileSpreadsheet size={14} /> {t.name} <X size={12} onClick={(e) => { e.stopPropagation(); onClose(t.id) }} className="ml-2" />
        </button>
      ))}
      <button onClick={onAdd} className="self-center p-1 text-zinc-500"><Plus size={16} /></button>
    </div>
  )
}
