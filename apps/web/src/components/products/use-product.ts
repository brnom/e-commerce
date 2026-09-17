'use client'

import { useQuery } from '@tanstack/react-query'

import { ApiError } from '@/lib/api-client'
import { getProduct, productKeys } from '@/lib/products-api'

export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404

export function useProduct(productId: string) {
  return useQuery({
    queryKey: productKeys.detail(productId),
    queryFn: () => getProduct(productId),
    retry: (count, error) => !isNotFound(error) && count < 1,
  })
}
