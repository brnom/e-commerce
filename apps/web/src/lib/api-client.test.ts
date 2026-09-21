import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiClient } from './api-client'

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('prefixes the request path with NEXT_PUBLIC_API_URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test:9999')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiClient<{ status: string }>('/health')

    expect(fetchMock).toHaveBeenCalledWith('http://api.test:9999/health', expect.anything())
    expect(result.status).toBe('ok')
  })

  it('throws an ApiError carrying status and body on non-2xx responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response(JSON.stringify({ status: 'error' }), { status: 503 })),
        ),
    )

    const error = await apiClient('/health').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 503, body: { status: 'error' } })
  })
})
