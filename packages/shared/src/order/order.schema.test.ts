import { describe, expect, it } from 'vitest'

import { createPlaceOrderSchema, passesLuhn, placeOrderSchema } from './order.schema'

const productA = '019968c2-4d6e-7c2a-9d1e-0a1b2c3d4e5f'
const productB = '019968c2-4d6e-7c2a-9d1e-0a1b2c3d4e60'

const valid = {
  items: [{ productId: productA, quantity: 2 }],
  customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  card: {
    cardholderName: 'Ada Lovelace',
    cardNumber: '4242 4242 4242 4242',
    expiry: '12/99',
    cvc: '123',
  },
}

const failingPaths = (result: {
  success: boolean
  error?: { issues: { path: PropertyKey[] }[] }
}) => (result.success ? [] : result.error!.issues.map((issue) => issue.path.join('.')))

const withCard = (card: Partial<typeof valid.card>) => ({
  ...valid,
  card: { ...valid.card, ...card },
})

describe('passesLuhn', () => {
  it('accepts the well-known test numbers', () => {
    expect(passesLuhn('4242424242424242')).toBe(true)
    expect(passesLuhn('4000000000000002')).toBe(true)
    expect(passesLuhn('4000000000009995')).toBe(true)
  })

  it('rejects a number off by one digit', () => {
    expect(passesLuhn('4242424242424241')).toBe(false)
  })
})

describe('placeOrderSchema', () => {
  it('accepts a valid order and strips spaces from the card number', () => {
    const order = placeOrderSchema.parse(valid)

    expect(order.card.cardNumber).toBe('4242424242424242')
    expect(order.items).toEqual([{ productId: productA, quantity: 2 }])
  })

  it('rejects a card number failing the Luhn check', () => {
    expect(
      failingPaths(placeOrderSchema.safeParse(withCard({ cardNumber: '4242 4242 4242 4241' }))),
    ).toEqual(['card.cardNumber'])
  })

  it('rejects a card number that is too short', () => {
    expect(failingPaths(placeOrderSchema.safeParse(withCard({ cardNumber: '1234' })))).toEqual([
      'card.cardNumber',
    ])
  })

  it('rejects an expired card', () => {
    expect(failingPaths(placeOrderSchema.safeParse(withCard({ expiry: '01/20' })))).toEqual([
      'card.expiry',
    ])
  })

  it('accepts the current month and rejects the previous one', () => {
    const schema = createPlaceOrderSchema(() => new Date(2026, 8, 21))

    expect(schema.safeParse(withCard({ expiry: '09/26' })).success).toBe(true)
    expect(failingPaths(schema.safeParse(withCard({ expiry: '08/26' })))).toEqual(['card.expiry'])
  })

  it('rejects a malformed expiry', () => {
    expect(failingPaths(placeOrderSchema.safeParse(withCard({ expiry: '13/30' })))).toEqual([
      'card.expiry',
    ])
    expect(failingPaths(placeOrderSchema.safeParse(withCard({ expiry: '2030-12' })))).toEqual([
      'card.expiry',
    ])
  })

  it('rejects a security code that is not 3 or 4 digits', () => {
    expect(failingPaths(placeOrderSchema.safeParse(withCard({ cvc: '12' })))).toEqual(['card.cvc'])
  })

  it('rejects a quantity out of range', () => {
    const zero = { ...valid, items: [{ productId: productA, quantity: 0 }] }
    const tooMany = { ...valid, items: [{ productId: productA, quantity: 101 }] }

    expect(failingPaths(placeOrderSchema.safeParse(zero))).toEqual(['items.0.quantity'])
    expect(failingPaths(placeOrderSchema.safeParse(tooMany))).toEqual(['items.0.quantity'])
  })

  it('rejects an empty order and one with too many items', () => {
    const many = Array.from({ length: 51 }, (_, index) => ({
      productId: `019968c2-4d6e-7c2a-9d1e-${String(index).padStart(12, '0')}`,
      quantity: 1,
    }))

    expect(failingPaths(placeOrderSchema.safeParse({ ...valid, items: [] }))).toEqual(['items'])
    expect(failingPaths(placeOrderSchema.safeParse({ ...valid, items: many }))).toEqual(['items'])
  })

  it('rejects the same product twice', () => {
    const repeated = {
      ...valid,
      items: [
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 1 },
        { productId: productA, quantity: 3 },
      ],
    }

    expect(failingPaths(placeOrderSchema.safeParse(repeated))).toEqual(['items'])
  })

  it('rejects an invalid email', () => {
    const order = { ...valid, customer: { ...valid.customer, email: 'not-an-email' } }

    expect(failingPaths(placeOrderSchema.safeParse(order))).toEqual(['customer.email'])
  })

  it('reports every failing field together', () => {
    const order = { ...withCard({ cvc: '12' }), customer: { name: '  ', email: 'ada@example.com' } }

    expect(failingPaths(placeOrderSchema.safeParse(order))).toEqual(['customer.name', 'card.cvc'])
  })
})
