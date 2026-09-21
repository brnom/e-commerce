import { useSyncExternalStore } from 'react'

import type { ProductResponse, UnavailableItem } from '@ecommerce/shared'

export interface CartLine {
  readonly productId: string
  readonly sku: string
  readonly name: string
  readonly unitPrice: number
  readonly quantity: number
}

export type CartProduct = Pick<ProductResponse, 'id' | 'sku' | 'name' | 'price'>

const STORAGE_KEY = 'cart'
const EMPTY: readonly CartLine[] = []

type Listener = () => void

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false
  const line = value as Record<string, unknown>
  return (
    typeof line['productId'] === 'string' &&
    typeof line['sku'] === 'string' &&
    typeof line['name'] === 'string' &&
    typeof line['unitPrice'] === 'number' &&
    typeof line['quantity'] === 'number' &&
    Number.isInteger(line['quantity']) &&
    line['quantity'] > 0
  )
}

function readStorage(): readonly CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : EMPTY
  } catch {
    return EMPTY
  }
}

function writeStorage(lines: readonly CartLine[]): void {
  try {
    if (lines.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    }
  } catch {
    return
  }
}

export class CartStore {
  private lines: readonly CartLine[] | null = null
  private readonly listeners = new Set<Listener>()

  getSnapshot = (): readonly CartLine[] => {
    if (this.lines === null) {
      this.lines = typeof window === 'undefined' ? EMPTY : readStorage()
    }
    return this.lines
  }

  getServerSnapshot = (): readonly CartLine[] => EMPTY

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  add(product: CartProduct, quantity: number): void {
    const lines = this.getSnapshot()
    const existing = lines.find((line) => line.productId === product.id)
    this.set(
      existing
        ? lines.map((line) =>
            line.productId === product.id ? { ...line, quantity: line.quantity + quantity } : line,
          )
        : [
            ...lines,
            {
              productId: product.id,
              sku: product.sku,
              name: product.name,
              unitPrice: product.price,
              quantity,
            },
          ],
    )
  }

  setQuantity(productId: string, quantity: number): void {
    if (quantity < 1) {
      this.remove(productId)
      return
    }
    this.set(
      this.getSnapshot().map((line) =>
        line.productId === productId ? { ...line, quantity } : line,
      ),
    )
  }

  remove(productId: string): void {
    this.set(this.getSnapshot().filter((line) => line.productId !== productId))
  }

  clear(): void {
    this.set(EMPTY)
  }

  applyUnavailable(items: readonly UnavailableItem[]): void {
    const byProduct = new Map(items.map((item) => [item.productId, item]))
    this.set(
      this.getSnapshot().flatMap((line) => {
        const item = byProduct.get(line.productId)
        if (!item) return [line]
        if (item.reason === 'unavailable' || item.available < 1) return []
        return [{ ...line, quantity: Math.min(line.quantity, item.available) }]
      }),
    )
  }

  private set(lines: readonly CartLine[]): void {
    this.lines = lines
    writeStorage(lines)
    for (const listener of this.listeners) listener()
  }
}

export const cartStore = new CartStore()

export function useCart(store: CartStore = cartStore): readonly CartLine[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

export function cartTotal(lines: readonly CartLine[]): number {
  return (
    lines.reduce((sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity, 0) / 100
  )
}

export function lineTotal(line: CartLine): number {
  return (Math.round(line.unitPrice * 100) * line.quantity) / 100
}
