import { z } from 'zod'

export const MAX_ORDER_ITEMS = 50

export const orderItemSchema = z.object({
  productId: z.uuid({ error: 'Product id must be a uuid' }),
  quantity: z
    .number({ error: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1'),
})

export const checkoutCustomerSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .max(254, 'Email must be at most 254 characters')
    .pipe(z.email({ error: 'Enter a valid email address' })),
})

export function passesLuhn(digits: string): boolean {
  let sum = 0
  let double = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

const EXPIRY = /^(0[1-9]|1[0-2])\/(\d{2})$/

function expiryIsCurrentOrLater(expiry: string, now: Date): boolean {
  const match = EXPIRY.exec(expiry)
  if (!match) return false
  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() + 1
  return year > nowYear || (year === nowYear && month >= nowMonth)
}

export const cardNumberSchema = z
  .string({ error: 'Card number is required' })
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(
    z
      .string()
      .regex(/^\d{13,19}$/, { message: 'Card number must be 13 to 19 digits', abort: true })
      .refine(passesLuhn, { message: 'Card number is not valid' }),
  )

export function createPaymentCardSchema(now: () => Date = () => new Date()) {
  return z.object({
    cardholderName: z
      .string({ error: 'Cardholder name is required' })
      .trim()
      .min(1, 'Cardholder name is required')
      .max(100, 'Cardholder name must be at most 100 characters'),
    cardNumber: cardNumberSchema,
    expiry: z
      .string({ error: 'Expiry is required' })
      .trim()
      .regex(EXPIRY, { message: 'Expiry must be MM/YY', abort: true })
      .refine((value) => expiryIsCurrentOrLater(value, now()), { message: 'Card has expired' }),
    cvc: z
      .string({ error: 'Security code is required' })
      .trim()
      .regex(/^\d{3,4}$/, 'Security code must be 3 or 4 digits'),
  })
}

export const paymentCardSchema = createPaymentCardSchema()

const noRepeatedProduct = (items: ReadonlyArray<{ productId: string }>) =>
  new Set(items.map((item) => item.productId)).size === items.length

export function createPlaceOrderSchema(now: () => Date = () => new Date()) {
  return z.object({
    items: z
      .array(orderItemSchema)
      .min(1, 'The order must have at least one item')
      .max(MAX_ORDER_ITEMS, `The order must have at most ${MAX_ORDER_ITEMS} items`)
      .refine(noRepeatedProduct, { message: 'Each product may appear only once' }),
    customer: checkoutCustomerSchema,
    card: createPaymentCardSchema(now),
  })
}

export const placeOrderSchema = createPlaceOrderSchema()

export const orderStatuses = ['pending', 'paid', 'payment_failed'] as const

export const orderCustomerSchema = z.object({
  name: z.string(),
  email: z.string(),
})

export const orderLineSchema = z.object({
  productId: z.uuid(),
  sku: z.string(),
  name: z.string(),
  unitPrice: z.number(),
  quantity: z.number().int(),
  lineTotal: z.number(),
})

export const orderPaymentSchema = z.object({
  cardLast4: z.string(),
  reference: z.string().nullable(),
  declineReason: z.string().nullable(),
})

export const orderSummarySchema = z.object({
  id: z.uuid(),
  status: z.enum(orderStatuses),
  customer: orderCustomerSchema,
  itemCount: z.number().int(),
  total: z.number(),
  createdAt: z.string(),
})

export const orderResponseSchema = orderSummarySchema.extend({
  lines: z.array(orderLineSchema),
  payment: orderPaymentSchema,
  updatedAt: z.string(),
})

export const unavailableReasons = ['insufficient_stock', 'unavailable'] as const

export const unavailableItemSchema = z.object({
  productId: z.string(),
  requested: z.number().int(),
  available: z.number().int(),
  reason: z.enum(unavailableReasons),
})

export const unavailableItemsBodySchema = z.object({
  message: z.string(),
  items: z.array(unavailableItemSchema),
})

export type OrderItem = z.infer<typeof orderItemSchema>
export type CheckoutCustomer = z.infer<typeof checkoutCustomerSchema>
export type PaymentCardInput = z.input<typeof paymentCardSchema>
export type PaymentCard = z.output<typeof paymentCardSchema>
export type PlaceOrderInput = z.input<typeof placeOrderSchema>
export type PlaceOrder = z.output<typeof placeOrderSchema>
export type OrderStatus = (typeof orderStatuses)[number]
export type OrderCustomer = z.infer<typeof orderCustomerSchema>
export type OrderLineResponse = z.infer<typeof orderLineSchema>
export type OrderPayment = z.infer<typeof orderPaymentSchema>
export type OrderSummaryResponse = z.infer<typeof orderSummarySchema>
export type OrderResponse = z.infer<typeof orderResponseSchema>
export type UnavailableReason = (typeof unavailableReasons)[number]
export type UnavailableItem = z.infer<typeof unavailableItemSchema>
export type UnavailableItemsBody = z.infer<typeof unavailableItemsBodySchema>
