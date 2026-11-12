import type { Row } from '@/stores/dataStore'

export type ConnectorDataset = { rows: Row[]; columns: string[]; source?: string }

export type DataConnector = {
  id: string
  label: string
  extensions: string[]
  open: (file: File) => Promise<ConnectorDataset>
}

const connectors = new Map<string, DataConnector>()

export function registerConnector(connector: DataConnector) {
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(connector.id) || !connector.label.trim() || !connector.extensions.length || typeof connector.open !== 'function') {
    throw new Error('Connector requires a valid id, label, extensions, and open function')
  }
  const extensions = [...new Set(connector.extensions.map(extension => extension.replace(/^\./, '').toLowerCase()).filter(Boolean))]
  if (!extensions.length) throw new Error('Connector requires at least one valid extension')
  if (connectors.has(connector.id)) throw new Error(`Connector already registered: ${connector.id}`)
  connectors.set(connector.id, { ...connector, extensions })
  return () => connectors.delete(connector.id)
}

export function listConnectors() { return [...connectors.values()] }

export function connectorForFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  return listConnectors().find(connector => extension && connector.extensions.includes(extension))
}

export function validateConnectorDataset(dataset: ConnectorDataset): ConnectorDataset {
  if (!dataset || !Array.isArray(dataset.rows) || !Array.isArray(dataset.columns) || dataset.columns.some(column => typeof column !== 'string')) {
    throw new Error('Connector returned an invalid dataset')
  }
  const columns = [...new Set(dataset.columns)]
  const rows = dataset.rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Connector returned an invalid row')
    return Object.fromEntries(columns.map(column => [column, row[column] ?? ''])) as Row
  })
  return { rows, columns, source: dataset.source }
}
