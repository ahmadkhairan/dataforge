import { describe, expect, it, vi } from 'vitest'
import { createHttpSyncProvider, createMemorySyncProvider } from './sync'

describe('sync provider contract', () => {
  it('round-trips a workspace snapshot', async () => {
    const provider = createMemorySyncProvider()
    const snapshot = { id: 'workspace', version: 1, updatedAt: new Date().toISOString(), rows: [{ id: 1 }], columns: ['id'] }
    await provider.save(snapshot)
    await expect(provider.load('workspace')).resolves.toEqual(snapshot)
    await expect(provider.load('missing')).resolves.toBeNull()
  })

  it('uses the HTTP workspace contract', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'remote', version: 2, updatedAt: '', rows: [], columns: [] }) })
    vi.stubGlobal('fetch', fetcher)
    const provider = createHttpSyncProvider('https://sync.example.test/', 'token')
    await provider.save({ id: 'remote', version: 2, updatedAt: '', rows: [], columns: [] })
    await provider.load('remote')
    expect(fetcher).toHaveBeenCalledWith('https://sync.example.test/workspaces/remote', expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer token' }) }))
    vi.unstubAllGlobals()
  })

  it('turns stale workspace writes into an actionable conflict', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }))
    const provider = createHttpSyncProvider('https://sync.example.test', 'token')
    await expect(provider.save({ id: 'remote', version: 2, baseVersion: 1, updatedAt: '', rows: [], columns: [] })).rejects.toThrow('Load the latest version')
    vi.unstubAllGlobals()
  })
})
