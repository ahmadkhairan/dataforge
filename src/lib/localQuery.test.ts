import { describe, expect, it } from 'vitest'
import { executeLocalQuery } from './localQuery'

const rows = [
  { region: 'Jakarta', revenue: 100, status: 'done' },
  { region: 'Bandung', revenue: 50, status: 'pending' },
  { region: 'Jakarta', revenue: 25, status: 'done' },
]

describe('local SQL query', () => {
  it('filters, projects, orders, and limits', () => {
    expect(executeLocalQuery("SELECT region, revenue AS total FROM sales WHERE status = 'done' ORDER BY revenue DESC LIMIT 1", rows)).toEqual([{ region: 'Jakarta', total: 100 }])
  })
  it('groups with count and sum', () => {
    expect(executeLocalQuery('SELECT region, COUNT(*) AS orders, SUM(revenue) AS total FROM sales GROUP BY region ORDER BY total DESC', rows)).toEqual([
      { region: 'Jakarta', orders: 2, total: 125 }, { region: 'Bandung', orders: 1, total: 50 },
    ])
  })
})
