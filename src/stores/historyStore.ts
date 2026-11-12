import { create } from 'zustand'

type Entry = { sql: string; label: string; rows: number; at: number }

type HistoryState = {
  queries: Entry[]
  push: (sql: string, rows: number) => void
  clear: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  queries: [],
  push: (sql, rows) => {
    const label = sql.replace(/\s+/g, ' ').trim().slice(0, 44) || 'Untitled query'
    const next = [{ sql, label, rows, at: Date.now() }, ...get().queries.filter((q) => q.sql !== sql)].slice(0, 20)
    set({ queries: next })
  },
  clear: () => set({ queries: [] }),
}))
