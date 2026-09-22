'use client'

import Link from 'next/link'

import { cartCount, useCart } from '@/lib/cart-store'

export function CartLink({ className }: { readonly className?: string }) {
  const count = cartCount(useCart())
  return (
    <Link
      href="/cart"
      className={className}
      aria-label={count > 0 ? `Cart, ${count} items` : 'Cart'}
    >
      Cart
      {count > 0 && (
        <span
          key={count}
          className="ml-1.5 inline-flex min-w-5 animate-in items-center justify-center rounded-full bg-foreground px-1.5 font-mono text-[11px] leading-5 text-background tabular-nums duration-200 zoom-in-50"
        >
          {count}
        </span>
      )}
    </Link>
  )
}
