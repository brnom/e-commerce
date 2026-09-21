import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CartStore, cartCount, cartTotal, lineTotal } from './cart-store'

const shoes = { id: 'p-shoes', sku: 'RS-001', name: 'Running Shoes', price: 89.99 }
const mouse = { id: 'p-mouse', sku: 'WM-042', name: 'Wireless Mouse', price: 19.99 }

describe('CartStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accumulates the quantity when the same product is added again', () => {
    const store = new CartStore()
    store.add(shoes, 1)
    store.add(mouse, 2)
    store.add(shoes, 2)

    expect(store.getSnapshot()).toEqual([
      { productId: 'p-shoes', sku: 'RS-001', name: 'Running Shoes', unitPrice: 89.99, quantity: 3 },
      {
        productId: 'p-mouse',
        sku: 'WM-042',
        name: 'Wireless Mouse',
        unitPrice: 19.99,
        quantity: 2,
      },
    ])
    expect(cartCount(store.getSnapshot())).toBe(5)
  })

  it('edits, removes and clears lines, notifying subscribers', () => {
    const store = new CartStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.add(shoes, 1)
    store.add(mouse, 1)

    store.setQuantity('p-shoes', 4)
    expect(store.getSnapshot()[0]!.quantity).toBe(4)

    store.setQuantity('p-mouse', 0)
    expect(store.getSnapshot().map((line) => line.productId)).toEqual(['p-shoes'])

    store.remove('p-shoes')
    expect(store.getSnapshot()).toEqual([])

    store.add(shoes, 1)
    store.clear()
    expect(store.getSnapshot()).toEqual([])
    expect(listener).toHaveBeenCalledTimes(7)
  })

  it('applies unavailable items by removing gone products and capping short ones', () => {
    const store = new CartStore()
    store.add(shoes, 3)
    store.add(mouse, 2)

    store.applyUnavailable([
      { productId: 'p-shoes', requested: 3, available: 1, reason: 'insufficient_stock' },
      { productId: 'p-mouse', requested: 2, available: 0, reason: 'unavailable' },
    ])

    expect(store.getSnapshot()).toEqual([
      expect.objectContaining({ productId: 'p-shoes', quantity: 1 }),
    ])
  })

  it('persists across store instances and ignores malformed storage', () => {
    new CartStore().add(shoes, 2)

    expect(new CartStore().getSnapshot()).toEqual([expect.objectContaining({ quantity: 2 })])

    window.localStorage.setItem('cart', '{"not":"a list"}')
    expect(new CartStore().getSnapshot()).toEqual([])
  })

  it('falls back to memory when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    const store = new CartStore()

    store.add(shoes, 1)

    expect(store.getSnapshot()).toHaveLength(1)
  })

  it('totals in cents', () => {
    const line = { productId: 'p', sku: 'S', name: 'N', unitPrice: 19.99, quantity: 3 }

    expect(lineTotal(line)).toBe(59.97)
    expect(cartTotal([line, { ...line, unitPrice: 0.1, quantity: 3 }])).toBe(60.27)
  })
})
