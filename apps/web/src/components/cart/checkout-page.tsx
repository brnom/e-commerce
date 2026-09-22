'use client'

import {
  approvedTestCard,
  findTestCard,
  placeOrderSchema,
  type PlaceOrderInput,
  type UnavailableItem,
} from '@ecommerce/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'

import { CartEmptyState, CartLinesTable, CartTotal } from './cart-page'
import {
  CUSTOM_CARD,
  TestCardSelect,
  TestCardTile,
  emptyCardValues,
  testCardValues,
  type CardSelection,
} from './test-card-select'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api-client'
import { cartStore, cartTotal, useCart, type CartLine } from '@/lib/cart-store'
import { formatMoney, formatShortId } from '@/lib/format'
import { orderKeys, placeOrder } from '@/lib/orders-api'
import { productKeys } from '@/lib/products-api'

const checkoutFormSchema = placeOrderSchema.pick({ customer: true, card: true })

type CheckoutFormValues = Pick<PlaceOrderInput, 'customer' | 'card'>

const fieldNames: ReadonlySet<string> = new Set([
  'customer.name',
  'customer.email',
  'card.cardholderName',
  'card.cardNumber',
  'card.expiry',
  'card.cvc',
])

const isFieldName = (path: string): path is FieldPath<CheckoutFormValues> => fieldNames.has(path)

type ValidationBody = { issues?: Array<{ path: string; message: string }> }
type UnavailableBody = { items?: UnavailableItem[] }

interface Declined {
  readonly orderId: string
  readonly reason: string
}

interface Adjustment {
  readonly name: string
  readonly reason: UnavailableItem['reason']
  readonly available: number
}

function describeAdjustments(
  lines: readonly CartLine[],
  items: readonly UnavailableItem[],
): Adjustment[] {
  return items.map((item) => ({
    name: lines.find((line) => line.productId === item.productId)?.name ?? item.productId,
    reason: item.reason,
    available: item.available,
  }))
}

const sampleCustomer: CheckoutFormValues['customer'] = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
}

const cardFields = ['cardholderName', 'cardNumber', 'expiry', 'cvc'] as const

const initialValues: CheckoutFormValues = {
  customer: sampleCustomer,
  card: testCardValues(approvedTestCard, sampleCustomer.name),
}

export function CheckoutPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const lines = useCart()
  const [declined, setDeclined] = useState<Declined | null>(null)
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [selection, setSelection] = useState<CardSelection>(approvedTestCard.id)
  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: initialValues,
  })
  const { errors, isSubmitting } = form.formState
  const selectedCard = selection === CUSTOM_CARD ? undefined : findTestCard(selection)
  const customerName = useWatch({ control: form.control, name: 'customer.name' })
  const expiry = useWatch({ control: form.control, name: 'card.expiry' })

  useEffect(() => {
    if (selectedCard) form.setValue('card.cardholderName', customerName)
  }, [form, selectedCard, customerName])

  function selectCard(next: CardSelection) {
    setSelection(next)
    const card = next === CUSTOM_CARD ? undefined : findTestCard(next)
    form.setValue(
      'card',
      card ? testCardValues(card, form.getValues('customer.name')) : emptyCardValues,
    )
    form.clearErrors('card')
  }

  const cardIssues = cardFields.flatMap((field) => {
    const message = errors.card?.[field]?.message
    return message ? [message] : []
  })

  const mutation = useMutation({
    mutationFn: placeOrder,
    onSuccess: async (order) => {
      if (order.status === 'paid') {
        cartStore.clear()
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: productKeys.all }),
          queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        ])
        router.push(`/orders/${order.id}`)
        return
      }
      await queryClient.invalidateQueries({ queryKey: orderKeys.all })
      setDeclined({ orderId: order.id, reason: order.payment.declineReason ?? 'Payment failed' })
    },
  })

  const submit = form.handleSubmit(async (values) => {
    setDeclined(null)
    setAdjustments([])
    try {
      await mutation.mutateAsync({
        items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        customer: values.customer,
        card: values.card,
      })
    } catch (error) {
      if (!applyApiError(error)) {
        form.setError('root', { message: 'The order could not be placed. Try again.' })
      }
    }
  })

  function applyApiError(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false
    if (error.status === 400) {
      const issues = (error.body as ValidationBody).issues ?? []
      const fieldIssues = issues.filter((issue) => isFieldName(issue.path))
      for (const issue of fieldIssues) {
        if (isFieldName(issue.path)) form.setError(issue.path, { message: issue.message })
      }
      const cartIssues = issues.filter((issue) => !isFieldName(issue.path))
      if (fieldIssues.length === 0 && cartIssues.length > 0) {
        form.setError('root', { message: cartIssues.map((issue) => issue.message).join('. ') })
      }
      return issues.length > 0
    }
    if (error.status === 409) {
      const items = (error.body as UnavailableBody).items ?? []
      setAdjustments(describeAdjustments(lines, items))
      cartStore.applyUnavailable(items)
      return true
    }
    return false
  }

  if (lines.length === 0 && adjustments.length === 0) {
    return (
      <main className="flex flex-col gap-8">
        <PageHeader title="Checkout" eyebrow="Purchase" />
        <CartEmptyState />
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-8">
      <PageHeader title="Checkout" eyebrow="Purchase" />
      {declined && (
        <div role="alert" className="rounded-lg border border-destructive p-4">
          <p className="font-medium">Payment declined: {declined.reason}</p>
          <p className="text-sm text-muted-foreground">
            Your cart was kept. Try another card, or review{' '}
            <Link href={`/orders/${declined.orderId}`} className="text-link underline">
              order {formatShortId(declined.orderId)}
            </Link>
            .
          </p>
        </div>
      )}
      {adjustments.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive p-4">
          <p className="font-medium">Some items changed since you filled your cart</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
            {adjustments.map((adjustment) => (
              <li key={adjustment.name}>
                {adjustment.reason === 'unavailable' || adjustment.available < 1
                  ? `${adjustment.name} is no longer available and was removed`
                  : `${adjustment.name}: only ${adjustment.available} in stock, quantity lowered`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
        <Form {...form}>
          <form onSubmit={submit} noValidate>
            <Card>
              <CardContent className="grid gap-8">
                <fieldset className="grid gap-6">
                  <legend className="mb-4 font-mono text-xs tracking-wider text-muted-foreground uppercase">
                    Customer
                  </legend>
                  <FormField
                    control={form.control}
                    name="customer.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customer.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" autoComplete="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </fieldset>
                <fieldset className="grid gap-6">
                  <legend className="mb-4 font-mono text-xs tracking-wider text-muted-foreground uppercase">
                    Payment
                  </legend>
                  <TestCardSelect value={selection} onChange={selectCard} />
                  {selectedCard ? (
                    <TestCardTile
                      card={selectedCard}
                      cardholderName={customerName}
                      expiry={expiry}
                      issues={cardIssues}
                    />
                  ) : (
                    <div className="grid animate-in gap-6 fade-in">
                      <FormField
                        control={form.control}
                        name="card.cardholderName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cardholder name</FormLabel>
                            <FormControl>
                              <Input {...field} autoComplete="cc-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="card.cardNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Card number</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                inputMode="numeric"
                                autoComplete="cc-number"
                                placeholder="4242 4242 4242 4242"
                                className="font-mono"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-6 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="card.expiry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expiry</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  inputMode="numeric"
                                  autoComplete="cc-exp"
                                  placeholder="MM/YY"
                                  className="font-mono"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="card.cvc"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Security code</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  inputMode="numeric"
                                  autoComplete="cc-csc"
                                  className="font-mono"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </fieldset>
                {errors.root && <p role="alert">{errors.root.message}</p>}
              </CardContent>
              <CardFooter className="gap-2">
                <Button asChild variant="outline">
                  <Link href="/cart">Back to cart</Link>
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || lines.length === 0}
                  className="ml-auto"
                >
                  {isSubmitting
                    ? 'Placing order…'
                    : `Place order · ${formatMoney(cartTotal(lines))}`}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <h2 className="display-heading text-2xl">Summary</h2>
          {lines.length > 0 ? (
            <>
              <CartLinesTable lines={lines} editable={false} />
              <CartTotal lines={lines} />
            </>
          ) : (
            <p className="text-muted-foreground">Nothing left in the cart.</p>
          )}
        </aside>
      </div>
    </main>
  )
}
