import { OrderPage } from '@/components/orders/order-page'

export default async function OrderRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderPage orderId={id} />
}
