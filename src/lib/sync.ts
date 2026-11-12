import type { Row } from '@/stores/dataStore'

export type WorkspaceSnapshot = { id: string; version: number; baseVersion?: number; updatedAt: string; rows: Row[]; columns: string[] }

export type SyncProvider = {
  id: string
  label: string
  save: (snapshot: WorkspaceSnapshot) => Promise<void>
  load: (id: string) => Promise<WorkspaceSnapshot | null>
}

export function createHttpSyncProvider(baseUrl: string, token?: string): SyncProvider {
  const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }
  const base = baseUrl.replace(/\/$/, '')
  return {
    id: 'http', label: 'HTTP sync',
    async save(snapshot) {
      const response = await fetch(`${base}/workspaces/${encodeURIComponent(snapshot.id)}`, { method: 'PUT', headers, body: JSON.stringify(snapshot) })
      if (response.status === 409) throw new Error('Workspace conflict: Load the latest version before sharing again')
      if (!response.ok) throw new Error(`Sync save failed: ${response.status}`)
    },
    async load(id) {
      const response = await fetch(`${base}/workspaces/${encodeURIComponent(id)}`, { headers })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`Sync load failed: ${response.status}`)
      return await response.json() as WorkspaceSnapshot
    },
  }
}

export function createMemorySyncProvider(): SyncProvider {
  const snapshots = new Map<string, WorkspaceSnapshot>()
  return {
    id: 'memory', label: 'Local memory',
    async save(snapshot) { snapshots.set(snapshot.id, structuredClone(snapshot)) },
    async load(id) { return snapshots.has(id) ? structuredClone(snapshots.get(id)!) : null },
  }
}
