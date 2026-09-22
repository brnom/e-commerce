import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SiteHeader } from './site-header'
import { cartStore } from '@/lib/cart-store'
import { renderWithQuery, stubApi } from '@/test-utils'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

describe('SiteHeader', () => {
  beforeEach(() => {
    cartStore.clear()
  })

  it('links to the home, products, imports, orders and cart pages', () => {
    stubApi([{ path: /\/health$/, body: { status: 'ok' } }])
    renderWithQuery(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'E-commerce' })).toHaveAttribute('href', '/')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/products')
    expect(within(nav).getByRole('link', { name: 'Imports' })).toHaveAttribute('href', '/imports')
    expect(within(nav).getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/orders')
    expect(within(nav).getByRole('link', { name: 'Cart' })).toHaveAttribute('href', '/cart')
  })

  it('shows the number of items in the cart', () => {
    stubApi([{ path: /\/health$/, body: { status: 'ok' } }])
    cartStore.add({ id: 'p1', sku: 'RS-001', name: 'Running Shoes', price: 89.99 }, 1)
    cartStore.add({ id: 'p2', sku: 'WM-042', name: 'Wireless Mouse', price: 19.99 }, 2)
    renderWithQuery(<SiteHeader />)

    const link = screen.getByRole('link', { name: 'Cart, 3 items' })
    expect(link).toHaveAttribute('href', '/cart')
    expect(link).toHaveTextContent('3')
  })
})
