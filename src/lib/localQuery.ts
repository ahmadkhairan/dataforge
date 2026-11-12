import type { Row } from '@/stores/dataStore'

export function executeLocalQuery(sql: string, source: Row[]): Row[] {
  const query = sql.replace(/;\s*$/, '').trim()
  let rows = [...source]
  const where = query.match(/\bwhere\s+([\w]+)\s*(=|!=|>=|<=|>|<)\s*(?:'([^']*)'|"([^"]*)"|([-\d.]+))/i)
  if (where) {
    const [, column, operator, quotedSingle, quotedDouble, numeric] = where
    const expected = quotedSingle ?? quotedDouble ?? numeric ?? ''
    rows = rows.filter(row => {
      const actual = row[column]
      const left = numeric !== undefined ? Number(actual) : String(actual ?? '')
      const right = numeric !== undefined ? Number(expected) : expected
      if (operator === '=') return left === right
      if (operator === '!=') return left !== right
      if (operator === '>') return left > right
      if (operator === '<') return left < right
      if (operator === '>=') return left >= right
      return left <= right
    })
  }

  const group = query.match(/\bgroup\s+by\s+([\w]+)/i)?.[1]
  if (group) {
    const groups = new Map<string, Row>()
    const countAlias = query.match(/count\s*\(\s*\*\s*\)\s*(?:as\s+([\w]+))?/i)?.[1] ?? 'count'
    const sumMatch = query.match(/sum\s*\(\s*([\w]+)\s*\)\s*(?:as\s+([\w]+))?/i)
    rows.forEach(row => {
      const key = String(row[group] ?? '')
      const current = groups.get(key) ?? { [group]: key, [countAlias]: 0 }
      current[countAlias] = Number(current[countAlias]) + 1
      if (sumMatch) current[sumMatch[2] ?? `sum_${sumMatch[1]}`] = Number(current[sumMatch[2] ?? `sum_${sumMatch[1]}`] ?? 0) + (Number(row[sumMatch[1]]) || 0)
      groups.set(key, current)
    })
    rows = [...groups.values()]
  } else {
    const select = query.match(/^\s*select\s+(.+?)\s+from\s+/i)?.[1]?.trim()
    if (select && select !== '*') {
      const selected = select.split(',').map(part => part.trim().split(/\s+as\s+/i)).map(([column, alias]) => ({ column, alias: alias || column }))
      rows = rows.map(row => Object.fromEntries(selected.map(({ column, alias }) => [alias, row[column]])))
    }
  }

  const order = query.match(/\border\s+by\s+([\w]+)(?:\s+(asc|desc))?/i)
  if (order) {
    const [, column, direction] = order
    rows.sort((a, b) => {
      const left = a[column] ?? ''; const right = b[column] ?? ''
      const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
      return direction?.toLowerCase() === 'desc' ? -comparison : comparison
    })
  }
  const limit = Number(query.match(/\blimit\s+(\d+)/i)?.[1])
  return Number.isFinite(limit) && limit >= 0 ? rows.slice(0, limit) : rows
}
