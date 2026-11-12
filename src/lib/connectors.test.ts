import { describe, expect, it } from 'vitest'
import { connectorForFile, listConnectors, registerConnector, validateConnectorDataset } from './connectors'

describe('connector registry', () => {
  it('registers, resolves, and unregisters custom connectors', () => {
    const id = `test-${Date.now()}`
    const unregister = registerConnector({ id, label: 'Test', extensions: ['.DEMO', 'demo'], open: async () => ({ rows: [], columns: [] }) })
    expect(listConnectors().some(connector => connector.id === id)).toBe(true)
    expect(connectorForFile(new File([], 'sample.demo'))?.id).toBe(id)
    unregister()
    expect(listConnectors().some(connector => connector.id === id)).toBe(false)
  })

  it('rejects invalid registrations and normalizes connector datasets', () => {
    expect(() => registerConnector({ id: 'bad id', label: 'Bad', extensions: ['x'], open: async () => ({ rows: [], columns: [] }) })).toThrow('valid id')
    expect(validateConnectorDataset({ columns: ['id', 'name', 'id'], rows: [{ id: 1, name: 'A' }, { id: 2 }] })).toEqual({ columns: ['id', 'name'], rows: [{ id: 1, name: 'A' }, { id: 2, name: '' }] })
    expect(() => validateConnectorDataset({ columns: ['id'], rows: [null as never] })).toThrow('invalid row')
  })
})
