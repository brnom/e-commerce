import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ImportReportPage } from './import-report-page'
import { renderWithQuery, stubApi } from '@/test-utils'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const id = '01a0c40d-90c3-750a-af78-7d4aa60d284e'
const job = {
  id,
  fileName: 'products.csv',
  createdAt: '2026-09-21T10:00:00.000Z',
  totals: { rows: 4, created: 1, updated: 1, skipped: 1, failed: 1 },
  rows: [
    { line: 2, sku: 'RS-001', name: 'Running Shoes', outcome: 'created', issues: [] },
    { line: 3, sku: 'CB-010', name: 'Coffee Beans', outcome: 'updated', issues: [] },
    {
      line: 4,
      sku: 'WM-042',
      name: 'Wireless Mouse',
      outcome: 'failed',
      issues: [{ path: 'price', message: 'Price must be a number' }],
    },
    { line: 5, sku: null, name: null, outcome: 'skipped', issues: [] },
  ],
}

describe('ImportReportPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the totals and every row with its outcome and issues', async () => {
    stubApi([{ path: new RegExp(`/imports/${id}$`), body: job }])
    renderWithQuery(<ImportReportPage importId={id} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'products.csv' })).toBeVisible()
    expect(screen.getByText(/#A60D284E · Imported/)).toBeInTheDocument()
    const sheet = screen.getByText('Rows', { selector: 'dt' }).closest('dl')!
    expect(within(sheet).getByText('4')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(5)
    const failed = screen.getByText('WM-042').closest('tr')!
    expect(within(failed).getByText('failed')).toBeInTheDocument()
    expect(failed).toHaveTextContent('price — Price must be a number')
  })

  it('filters down to failed and skipped rows', async () => {
    stubApi([{ path: new RegExp(`/imports/${id}$`), body: job }])
    const user = userEvent.setup()
    renderWithQuery(<ImportReportPage importId={id} />)
    await screen.findByText('RS-001')

    const toggle = screen.getByRole('button', { name: /Problems only/ })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('RS-001')).not.toBeInTheDocument()
    expect(screen.queryByText('CB-010')).not.toBeInTheDocument()
    expect(screen.getByText('WM-042')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('shows a not-found state for a 404', async () => {
    stubApi([{ path: /\/imports\//, status: 404, body: { message: 'No import' } }])
    renderWithQuery(<ImportReportPage importId={id} />)

    expect(await screen.findByRole('heading', { name: 'Import not found' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to imports' })).toHaveAttribute(
      'href',
      '/imports',
    )
  })
})
