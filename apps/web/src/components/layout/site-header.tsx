import Link from 'next/link'

import { ApiHealth } from '@/components/api-health'
import { CartLink } from '@/components/cart/cart-link'

const links = [
  { href: '/products', label: 'Products' },
  { href: '/imports', label: 'Imports' },
  { href: '/orders', label: 'Orders' },
]

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="display-heading text-sm tracking-[0.1em] whitespace-nowrap sm:text-lg sm:tracking-[0.2em]"
        >
          E-commerce
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4 sm:gap-6">
          <ul className="flex items-center gap-4 sm:gap-6">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-link text-xs font-medium tracking-wider uppercase sm:text-sm"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <CartLink className="text-link text-xs font-medium tracking-wider uppercase sm:text-sm" />
            </li>
          </ul>
          <ApiHealth className="hidden text-muted-foreground sm:inline-flex" />
        </nav>
      </div>
    </header>
  )
}
