export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
  }
}

export function getApiBaseUrl(): string {
  return process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:5001'
}

async function unwrap<T>(response: Response): Promise<T> {
  const body: unknown = response.status === 204 ? null : await response.json()
  if (!response.ok) {
    throw new ApiError(response.status, body)
  }
  return body as T
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  return unwrap<T>(response)
}

export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, { method: 'POST', body })
  return unwrap<T>(response)
}
