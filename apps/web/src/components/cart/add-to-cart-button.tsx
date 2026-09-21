'use client'

import { ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cartStore, type CartProduct } from '@/lib/cart-store'

import type { ComponentProps } from 'react'

interface Props extends Omit<ComponentProps<typeof Button>, 'onClick' | 'disabled' | 'children'> {
  readonly product: CartProduct & { readonly stock: number }
  readonly quantity?: number
  readonly onAdded?: () => void
}

const ADDED_FEEDBACK_MS = 1500

export function AddToCartButton({ product, quantity = 1, onAdded, ...rest }: Props) {
  const [added, setAdded] = useState(false)
  const outOfStock = product.stock < 1

  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [added])

  return (
    <Button
      type="button"
      disabled={outOfStock}
      aria-label={outOfStock ? `Out of stock: ${product.name}` : `Add ${product.name} to cart`}
      onClick={() => {
        cartStore.add(product, quantity)
        setAdded(true)
        onAdded?.()
      }}
      {...rest}
    >
      <ShoppingCart />
      {outOfStock ? 'Out of stock' : added ? 'Added' : 'Add to cart'}
    </Button>
  )
}
