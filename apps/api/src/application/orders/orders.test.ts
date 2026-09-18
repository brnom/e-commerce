import { beforeEach, describe, expect, it } from 'vitest'

import { FakePaymentGateway } from './__fakes__/fake-payment-gateway'
import { InMemoryOrderRepository } from './__fakes__/in-memory-order-repository'
import { GetOrder } from './get-order'
import { ListOrders } from './list-orders'
import { PlaceOrder, PROVIDER_UNAVAILABLE } from './place-order'
import { InMemoryCategoryRepository } from '@/application/products/__fakes__/in-memory-category-repository'
import { InMemoryProductRepository } from '@/application/products/__fakes__/in-memory-product-repository'
import { CreateProduct } from '@/application/products/create-product'
import { DeleteProduct } from '@/application/products/delete-product'
import { UpdateProduct } from '@/application/products/update-product'
import { NotFoundError, UnavailableItemsError } from '@/domain/shared/domain-error'

import type { PlaceOrder as PlaceOrderInput } from '@ecommerce/shared'

const card = {
  cardholderName: 'Ada Lovelace',
  cardNumber: '4242424242424242',
  expiry: '12/99',
  cvc: '123',
}

const customer = { name: 'Ada Lovelace', email: 'ada@example.com' }

const request = (items: PlaceOrderInput['items']): PlaceOrderInput => ({
  items,
  customer,
  card,
})

describe('PlaceOrder', () => {
  let categories: InMemoryCategoryRepository
  let products: InMemoryProductRepository
  let orders: InMemoryOrderRepository
  let gateway: FakePaymentGateway
  let placeOrder: PlaceOrder
  let shoes: string
  let mouse: string

  beforeEach(async () => {
    categories = new InMemoryCategoryRepository()
    products = new InMemoryProductRepository(() => categories.rows)
    orders = new InMemoryOrderRepository(products)
    gateway = new FakePaymentGateway()
    placeOrder = new PlaceOrder(orders, gateway)
    const create = new CreateProduct(products, categories)
    shoes = (await create.execute({ sku: 'RS-001', name: 'Running Shoes', price: 89.99, stock: 5 }))
      .id
    mouse = (
      await create.execute({ sku: 'WM-042', name: 'Wireless Mouse', price: 19.99, stock: 10 })
    ).id
  })

  const stockOf = async (id: string) => (await products.findById(id))!.stock

  it('reserves stock, charges the total and records a paid order', async () => {
    const order = await placeOrder.execute(
      request([
        { productId: shoes, quantity: 2 },
        { productId: mouse, quantity: 3 },
      ]),
    )

    expect(order.status).toBe('paid')
    expect(order.lines).toEqual([
      expect.objectContaining({ sku: 'RS-001', unitPrice: 89.99, quantity: 2, lineTotal: 179.98 }),
      expect.objectContaining({ sku: 'WM-042', unitPrice: 19.99, quantity: 3, lineTotal: 59.97 }),
    ])
    expect(order.total).toBe(239.95)
    expect(order.itemCount).toBe(5)
    expect(order.payment).toEqual({ cardLast4: '4242', reference: 'fake_ref', declineReason: null })
    expect(order.customer).toEqual(customer)
    expect(gateway.charges).toEqual([{ orderId: order.id, amount: 239.95, card }])
    expect(await stockOf(shoes)).toBe(3)
    expect(await stockOf(mouse)).toBe(7)
  })

  it('restores stock and records the reason when the payment is declined', async () => {
    gateway.next = { outcome: 'declined', reason: 'Your card was declined' }

    const order = await placeOrder.execute(request([{ productId: shoes, quantity: 2 }]))

    expect(order.status).toBe('payment_failed')
    expect(order.payment).toEqual({
      cardLast4: '4242',
      reference: null,
      declineReason: 'Your card was declined',
    })
    expect(await stockOf(shoes)).toBe(5)
  })

  it('settles as failed when the provider throws', async () => {
    gateway.next = new Error('connection reset')

    const order = await placeOrder.execute(request([{ productId: shoes, quantity: 1 }]))

    expect(order.status).toBe('payment_failed')
    expect(order.payment.declineReason).toBe(PROVIDER_UNAVAILABLE)
    expect(await stockOf(shoes)).toBe(5)
  })

  it('rejects the whole order when one item is short, listing every problem', async () => {
    const deleted = (
      await new CreateProduct(products, categories).execute({
        sku: 'LW-019',
        name: 'Lamp',
        price: 10,
        stock: 1,
      })
    ).id
    await new DeleteProduct(products).execute(deleted)

    const attempt = placeOrder.execute(
      request([
        { productId: shoes, quantity: 2 },
        { productId: mouse, quantity: 11 },
        { productId: deleted, quantity: 1 },
        { productId: 'missing', quantity: 1 },
      ]),
    )

    await expect(attempt).rejects.toBeInstanceOf(UnavailableItemsError)
    await attempt.catch((error: UnavailableItemsError) => {
      expect(error.items).toEqual([
        { productId: mouse, requested: 11, available: 10, reason: 'insufficient_stock' },
        { productId: deleted, requested: 1, available: 0, reason: 'unavailable' },
        { productId: 'missing', requested: 1, available: 0, reason: 'unavailable' },
      ])
    })
    expect(await stockOf(shoes)).toBe(5)
    expect(await stockOf(mouse)).toBe(10)
    expect(gateway.charges).toEqual([])
    expect(await new ListOrders(orders).execute()).toEqual([])
  })

  it('keeps the price at the time of purchase', async () => {
    const order = await placeOrder.execute(request([{ productId: mouse, quantity: 3 }]))
    await new UpdateProduct(products, categories).execute(mouse, { price: 25 })

    const stored = await new GetOrder(orders).execute(order.id)

    expect(stored.lines[0]).toMatchObject({ unitPrice: 19.99, lineTotal: 59.97 })
    expect(stored.total).toBe(59.97)
  })

  it('lists orders newest first as summaries', async () => {
    const first = await placeOrder.execute(request([{ productId: shoes, quantity: 1 }]))
    const second = await placeOrder.execute(request([{ productId: mouse, quantity: 2 }]))

    const summaries = await new ListOrders(orders).execute()

    expect(summaries.map((summary) => summary.id)).toEqual([second.id, first.id])
    expect(summaries[0]).toEqual({
      id: second.id,
      status: 'paid',
      customer,
      itemCount: 2,
      total: 39.98,
      createdAt: second.createdAt,
    })
  })

  it('reports an unknown order as not found', async () => {
    await expect(new GetOrder(orders).execute('missing')).rejects.toBeInstanceOf(NotFoundError)
  })
})
