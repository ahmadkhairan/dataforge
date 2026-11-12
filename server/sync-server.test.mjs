import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createSyncServer } from './sync-server.mjs'

test('sync server authenticates and round-trips workspace snapshots', async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'dataforge-sync-'))
  const server = createSyncServer({ token: 'test-token', dataDir })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    await rm(dataDir, { recursive: true, force: true })
  })

  const { port } = server.address()
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${port}/healthz`)).json(), { status: 'ok' })
  const url = `http://127.0.0.1:${port}/workspaces/demo`
  assert.equal((await fetch(url)).status, 401)

  const snapshot = { id: 'demo', version: 1, updatedAt: new Date().toISOString(), rows: [{ id: 1 }], columns: ['id'] }
  const saved = await fetch(url, { method: 'PUT', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body: JSON.stringify(snapshot) })
  assert.equal(saved.status, 204)
  const conflict = await fetch(url, { method: 'PUT', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' }, body: JSON.stringify({ ...snapshot, version: 2, baseVersion: 0 }) })
  assert.equal(conflict.status, 409)
  const loaded = await fetch(url, { headers: { authorization: 'Bearer test-token' } })
  assert.equal(loaded.status, 200)
  assert.deepEqual(await loaded.json(), snapshot)
})
