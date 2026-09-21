import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SiteHeader } from './site-header'
import { renderWithQuery, stubApi } from '@/test-utils'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

describe('SiteHeader', () => {
  it('links to the home, products and imports pages', () => {
    stubApi([{ path: /\/health$/, body: { status: 'ok' } }])
    renderWithQuery(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'E-commerce' })).toHaveAttribute('href', '/')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/products')
    expect(within(nav).getByRole('link', { name: 'Imports' })).toHaveAttribute('href', '/imports')
  })
})
