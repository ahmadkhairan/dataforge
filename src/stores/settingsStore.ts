import { create } from 'zustand'

type SettingsState = {
  dark: boolean
  mode: 'sheet' | 'sql'
  toggleDark: () => void
  setMode: (m: 'sheet' | 'sql') => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  dark: false,
  mode: 'sheet',
  toggleDark: () => set((s) => ({ dark: !s.dark })),
  setMode: (mode) => set({ mode }),
}))
