import { apiClient } from './api-client'

import type { OrderResponse, OrderSummaryResponse, PlaceOrderInput } from '@ecommerce/shared'

export const orderKeys = {
  all: ['orders'] as const,
  list: () => ['orders', 'list'] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
}

export function placeOrder(input: PlaceOrderInput): Promise<OrderResponse> {
  return apiClient<OrderResponse>('/orders', { method: 'POST', body: JSON.stringify(input) })
}

export function listOrders(): Promise<OrderSummaryResponse[]> {
  return apiClient<OrderSummaryResponse[]>('/orders')
}

export function getOrder(id: string): Promise<OrderResponse> {
  return apiClient<OrderResponse>(`/orders/${encodeURIComponent(id)}`)
}
