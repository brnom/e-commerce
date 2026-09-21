import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiHealth } from './api-health'

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('ApiHealth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows ok when the API responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    )

    renderWithQuery(<ApiHealth />)

    expect(await screen.findByText('API: ok')).toBeInTheDocument()
  })

  it('shows unreachable when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    renderWithQuery(<ApiHealth />)

    expect(await screen.findByText('API: unreachable')).toBeInTheDocument()
  })
})
