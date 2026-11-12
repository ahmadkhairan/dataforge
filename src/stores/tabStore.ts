import { create } from 'zustand'
import type { Row } from './dataStore'

export type Tab = {
  id: string
  name: string
  columns: string[]
  rows: Row[]
}

type TabState = {
  tabs: Tab[]
  activeId: string
  addTab: (tab: Tab) => void
  closeTab: (id: string) => void
  setActive: (id: string) => void
  updateActive: (patch: Partial<Tab>) => void
}

const genId = () => Math.random().toString(36).slice(2, 8)

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [{ id: 'sales', name: 'sales_data.csv', columns: ['order_id','customer','region'], rows: [] }],
  activeId: 'sales',
  addTab: (tab) => {
    const id = tab.id || genId()
    set((s) => ({ tabs: [...s.tabs, { ...tab, id }], activeId: id }))
  },
  closeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id)
      if (!tabs.length) return s
      return { tabs, activeId: s.activeId === id ? tabs[0].id : s.activeId }
    }),
  setActive: (id) => set({ activeId: id }),
  updateActive: (patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === s.activeId ? { ...t, ...patch, columns: patch.columns ?? t.columns, rows: patch.rows ?? t.rows } : t)),
    })),
}))
