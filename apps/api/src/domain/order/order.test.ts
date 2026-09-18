import { describe, expect, it } from 'vitest'

import { computeTotals, lineTotal } from './order'

describe('computeTotals', () => {
  it('multiplies to the cent without floating point drift', () => {
    expect(lineTotal({ unitPrice: 19.99, quantity: 3 })).toBe(59.97)
    expect(computeTotals([{ unitPrice: 19.99, quantity: 3 }])).toEqual({
      lineTotals: [59.97],
      total: 59.97,
      itemCount: 3,
    })
  })

  it('sums several lines and counts every unit', () => {
    const totals = computeTotals([
      { unitPrice: 0.1, quantity: 3 },
      { unitPrice: 0.2, quantity: 1 },
      { unitPrice: 1234.56, quantity: 2 },
    ])

    expect(totals.lineTotals).toEqual([0.3, 0.2, 2469.12])
    expect(totals.total).toBe(2469.62)
    expect(totals.itemCount).toBe(6)
  })

  it('accepts a zero-priced line', () => {
    expect(computeTotals([{ unitPrice: 0, quantity: 5 }])).toEqual({
      lineTotals: [0],
      total: 0,
      itemCount: 5,
    })
  })
})
