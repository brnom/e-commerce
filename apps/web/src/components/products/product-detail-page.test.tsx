import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProductDetailPage } from './product-detail-page'
import { calls, renderWithQuery, stubApi } from '@/test-utils'

const push = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const id = '01a0c40d-90c3-750a-af78-7d4aa60d284e'
const product = {
  id,
  sku: 'RS-001',
  name: 'Running Shoes',
  description: 'Lightweight running shoes for daily training',
  price: 89.99,
  stock: 150,
  weightKg: 0.35,
  category: { id: 'c1', name: 'Footwear' },
  createdAt: '2026-09-21T10:00:00.000Z',
  updatedAt: '2026-09-21T12:00:00.000Z',
}

describe('ProductDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    push.mockReset()
  })

  it('shows every field of the product', async () => {
    stubApi([{ path: new RegExp(`/products/${id}$`), body: product }])
    renderWithQuery(<ProductDetailPage productId={id} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Running Shoes' })).toBeVisible()
    expect(screen.getByText('$89.99')).toBeInTheDocument()
    expect(screen.getByText('Lightweight running shoes for daily training')).toBeInTheDocument()
    const sheet = screen.getByText('SKU').closest('dl')!
    expect(within(sheet).getByText('RS-001')).toBeInTheDocument()
    expect(within(sheet).getByText('150')).toBeInTheDocument()
    expect(within(sheet).getByText('0.35 kg')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit product' })).toHaveAttribute(
      'href',
      `/products/${id}/edit`,
    )
  })

  it('shows a not-found state for a 404', async () => {
    stubApi([{ path: /\/products\//, status: 404, body: { message: 'No product' } }])
    renderWithQuery(<ProductDetailPage productId={id} />)

    expect(await screen.findByRole('heading', { name: 'Product not found' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to products' })).toHaveAttribute(
      'href',
      '/products',
    )
  })

  it('deletes after confirmation and navigates to the list', async () => {
    const fetchMock = stubApi([
      { path: new RegExp(`/products/${id}$`), body: product },
      { method: 'DELETE', path: new RegExp(`/products/${id}$`), status: 204 },
    ])
    renderWithQuery(<ProductDetailPage productId={id} />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Delete Running Shoes' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(calls(fetchMock, 'DELETE')).toHaveLength(1))
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/products'))
  })
})
