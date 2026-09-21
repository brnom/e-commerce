import { apiClient, apiUpload } from './api-client'

import type { ImportJob, ImportJobSummary } from '@ecommerce/shared'

export const importKeys = {
  all: ['imports'] as const,
  list: () => ['imports', 'list'] as const,
  detail: (id: string) => ['imports', 'detail', id] as const,
}

export function uploadImport(file: File): Promise<ImportJob> {
  const form = new FormData()
  form.append('file', file, file.name)
  return apiUpload<ImportJob>('/imports', form)
}

export function listImports(): Promise<ImportJobSummary[]> {
  return apiClient<ImportJobSummary[]>('/imports')
}

export function getImport(id: string): Promise<ImportJob> {
  return apiClient<ImportJob>(`/imports/${encodeURIComponent(id)}`)
}
