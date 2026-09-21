import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiClient, apiUpload } from './api-client'

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

describe('apiUpload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the form data without a json content type', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'job' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const form = new FormData()
    form.append('file', new Blob(['a,b']), 'x.csv')

    const result = await apiUpload<{ id: string }>('/imports', form)

    expect(result.id).toBe('job')
    const [, init] = fetchMock.mock.calls[0]!
    expect(init.method).toBe('POST')
    expect(init.body).toBe(form)
    expect(init.headers).toBeUndefined()
  })

  it('throws an ApiError with the body on a rejected upload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Missing required columns: sku' }), {
          status: 400,
        }),
      ),
    )

    const error = await apiUpload('/imports', new FormData()).catch((caught: unknown) => caught)

    expect(error).toMatchObject({ status: 400, body: { message: 'Missing required columns: sku' } })
  })
})
