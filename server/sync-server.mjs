import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const json = (response, status, body, corsOrigin) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': corsOrigin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
  })
  response.end(JSON.stringify(body))
}

const workspacePath = (dataDir, id) => join(dataDir, `${encodeURIComponent(id)}.json`)

async function readBody(request, maxBodyBytes) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBodyBytes) throw new Error('request body exceeds 10 MB')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function createSyncServer({ token, dataDir, corsOrigin = 'http://127.0.0.1:5173', maxBodyBytes = 10 * 1024 * 1024 }) {
  if (!token) throw new Error('DATAFORGE_SYNC_TOKEN is required')

  return createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {}, corsOrigin)
  if (request.method === 'GET' && request.url === '/healthz') return json(response, 200, { status: 'ok' }, corsOrigin)
  if (request.headers.authorization !== `Bearer ${token}`) return json(response, 401, { error: 'unauthorized' }, corsOrigin)

  const match = request.url?.match(/^\/workspaces\/([^/?]+)$/)
  if (!match || !['GET', 'PUT'].includes(request.method ?? '')) return json(response, 404, { error: 'not found' }, corsOrigin)
  const id = decodeURIComponent(match[1])
  const path = workspacePath(dataDir, id)

  try {
    if (request.method === 'GET') {
      try {
        return json(response, 200, JSON.parse(await readFile(path, 'utf8')), corsOrigin)
      } catch (error) {
        if (error.code === 'ENOENT') return json(response, 404, { error: 'workspace not found' }, corsOrigin)
        throw error
      }
    }

    const snapshot = await readBody(request, maxBodyBytes)
    if (!snapshot || typeof snapshot !== 'object' || snapshot.id !== id || !Array.isArray(snapshot.rows) || !Array.isArray(snapshot.columns)) {
      return json(response, 400, { error: 'invalid workspace snapshot' }, corsOrigin)
    }
    try {
      const current = JSON.parse(await readFile(path, 'utf8'))
      if (Number(snapshot.baseVersion ?? 0) !== Number(current.version)) return json(response, 409, { error: 'workspace version conflict', currentVersion: current.version }, corsOrigin)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await mkdir(dataDir, { recursive: true })
    const temporary = `${path}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(snapshot), 'utf8')
    await rename(temporary, path)
    return json(response, 204, {}, corsOrigin)
  } catch (error) {
    return json(response, 400, { error: error instanceof Error ? error.message : 'invalid request' }, corsOrigin)
  }
})
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.DATAFORGE_SYNC_HOST ?? '127.0.0.1'
  const port = Number(process.env.DATAFORGE_SYNC_PORT ?? 8787)
  const token = process.env.DATAFORGE_SYNC_TOKEN
  const dataDir = process.env.DATAFORGE_SYNC_DATA_DIR ?? join(process.cwd(), '.dataforge-sync')
  const server = createSyncServer({ token, dataDir, corsOrigin: process.env.DATAFORGE_SYNC_CORS_ORIGIN ?? 'http://127.0.0.1:5173' })
  server.listen(port, host, () => console.log(`DataForge sync server listening on http://${host}:${port}`))
  const shutdown = () => server.close(() => process.exit(0))
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
