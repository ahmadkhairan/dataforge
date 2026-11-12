import { describe, expect, it } from 'vitest'
import { evaluateCell } from './formula'

describe('formula evaluation', () => {
  const rows = [{ units: 2, revenue: 10 }, { units: 3, revenue: 20 }]
  const columns = ['units', 'revenue']

  it('evaluates ranges and arithmetic', () => {
    expect(evaluateCell('=SUM(B1:B2)', rows, columns, 0, 1)).toBe('30')
    expect(evaluateCell('=B1*2', rows, columns, 0, 1)).toBe('20')
  })

  it('returns ordinary values unchanged', () => {
    expect(evaluateCell('Completed', rows, columns, 0, 0)).toBe('Completed')
  })
})
