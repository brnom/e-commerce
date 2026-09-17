import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ImportsPage } from './imports-page'
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

const job = {
  id: '01a0c40d-90c3-750a-af78-7d4aa60d284e',
  fileName: 'products.csv',
  createdAt: '2026-09-21T10:00:00.000Z',
  totals: { rows: 97, created: 87, updated: 0, skipped: 2, failed: 8 },
}

const csvFile = () => new File(['name,sku,price,stock\nShoes,RS-1,1,1\n'], 'products.csv')

describe('ImportsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    push.mockReset()
  })

  it('uploads the chosen file as multipart and opens its report', async () => {
    const fetchMock = stubApi([
      { path: /\/imports$/, body: [] },
      { method: 'POST', path: /\/imports$/, status: 201, body: { ...job, rows: [] } },
    ])
    const user = userEvent.setup()
    renderWithQuery(<ImportsPage />)

    const button = screen.getByRole('button', { name: 'Import' })
    expect(button).toBeDisabled()
    await user.upload(screen.getByLabelText('CSV file'), csvFile())
    expect(button).toBeEnabled()
    await user.click(button)

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/imports/${job.id}`))
    const [, init] = calls(fetchMock, 'POST')[0]!
    expect(init?.body).toBeInstanceOf(FormData)
    expect((init?.body as FormData).get('file')).toBeInstanceOf(File)
    expect(init?.headers).toBeUndefined()
  })

  it('shows the API message when the file is rejected', async () => {
    stubApi([
      { path: /\/imports$/, body: [] },
      {
        method: 'POST',
        path: /\/imports$/,
        status: 400,
        body: { message: 'Missing required columns: sku, price', missingColumns: ['sku', 'price'] },
      },
    ])
    const user = userEvent.setup()
    renderWithQuery(<ImportsPage />)

    await user.upload(screen.getByLabelText('CSV file'), csvFile())
    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing required columns: sku, price',
    )
    expect(push).not.toHaveBeenCalled()
  })

  it('lists past imports with their totals linking to the report', async () => {
    stubApi([{ path: /\/imports$/, body: [job] }])
    renderWithQuery(<ImportsPage />)

    const link = await screen.findByRole('link', { name: 'products.csv' })
    expect(link).toHaveAttribute('href', `/imports/${job.id}`)
    const row = link.closest('tr')!
    expect(row).toHaveTextContent('87')
    expect(row).toHaveTextContent('8')
  })

  it('shows an empty state when nothing was imported yet', async () => {
    stubApi([{ path: /\/imports$/, body: [] }])
    renderWithQuery(<ImportsPage />)

    expect(await screen.findByRole('heading', { name: 'No imports yet' })).toBeVisible()
  })
})
