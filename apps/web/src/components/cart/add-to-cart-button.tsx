'use client'

import { Check, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cartStore, type CartProduct } from '@/lib/cart-store'
import { cn } from '@/lib/utils'

import type { ComponentProps } from 'react'

interface Props extends Omit<ComponentProps<typeof Button>, 'onClick' | 'disabled' | 'children'> {
  readonly product: CartProduct & { readonly stock: number }
  readonly quantity?: number
  readonly onAdded?: () => void
}

const ADDED_FEEDBACK_MS = 1500

const addedStyle =
  'border-foreground bg-foreground text-background hover:bg-foreground hover:text-background active:bg-foreground'

export function AddToCartButton({ product, quantity = 1, onAdded, className, ...rest }: Props) {
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
      data-added={added || undefined}
      aria-label={outOfStock ? `Out of stock: ${product.name}` : `Add ${product.name} to cart`}
      className={cn(added && addedStyle, className)}
      onClick={() => {
        cartStore.add(product, quantity)
        setAdded(true)
        onAdded?.()
      }}
      {...rest}
    >
      {added ? (
        <span key="added" className="inline-flex animate-in items-center gap-2 zoom-in-95 fade-in">
          <Check />
          Added
        </span>
      ) : (
        <span key="idle" className="inline-flex items-center gap-2">
          <ShoppingCart />
          {outOfStock ? 'Out of stock' : 'Add to cart'}
        </span>
      )}
    </Button>
  )
}
