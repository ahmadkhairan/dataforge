import { describe, expect, it } from 'vitest'
import { parseFile } from './fileParsers'
import { registerConnector } from './connectors'

describe('file parser', () => {
  it('parses CSV headers, quoted values, and rows', async () => {
    const file = new File(['id,name\n1,"Alya, Pratama"\n2,Bima'], 'sales.csv', { type: 'text/csv' })
    await expect(parseFile(file)).resolves.toEqual({
      columns: ['id', 'name'],
      rows: [{ id: '1', name: 'Alya, Pratama' }, { id: '2', name: 'Bima' }],
    })
  })

  it('normalizes JSON objects with different columns', async () => {
    const file = new File(['[{"id":1,"name":"A"},{"id":2,"status":"ok"}]'], 'data.json', { type: 'application/json' })
    await expect(parseFile(file)).resolves.toEqual({
      columns: ['id', 'name', 'status'],
      rows: [{ id: 1, name: 'A', status: '' }, { id: 2, name: '', status: 'ok' }],
    })
  })

  it('rejects oversized imports before parsing', async () => {
    const file = { name: 'large.json', size: 100 * 1024 * 1024 + 1 } as File
    await expect(parseFile(file)).rejects.toThrow('100 MB import limit')
  })

  it('routes registered extensions through custom connectors', async () => {
    const unregister = registerConnector({
      id: `test-parser-${Date.now()}`,
      label: 'Test parser',
      extensions: ['custom'],
      open: async (file) => ({ rows: [{ source: file.name, value: 'connected' }], columns: ['source', 'value'] }),
    })

    await expect(parseFile(new File(['ignored'], 'sample.custom'))).resolves.toEqual({
      columns: ['source', 'value'],
      rows: [{ source: 'sample.custom', value: 'connected' }],
    })
    unregister()
  })
})
