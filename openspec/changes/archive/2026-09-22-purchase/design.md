# Design

## Context

See proposal.md — Why. The catalog exposes `stock` as a plain integer on `Product`, soft-deletes products (`deletedAt`) and keeps every write inside one repository method. The import change established the pattern for a multi-row atomic write: a single port method (`ImportJobRepository.commit`) owns the interactive transaction, and the use case stays framework-free. There is no authentication and no customer entity; the web app is client-side rendered, with TanStack Query for server state and `react-hook-form` + zod for forms. Money is `Decimal(12, 2)` in the database and `number` in JSON; the UI formats it as USD.

A purchase is the first write that spans a call to an external system (the payment provider) between two database writes, and the first state that lives in the browser across pages (the cart).

## Goals / Non-Goals

**Goals:**

- Stock can never go negative, whatever the concurrency, and a failed payment leaves stock exactly as it was.
- The payment provider is a port; the fake adapter is deterministic so the decline path is a test and a demo, not a coincidence.
- Nothing sensitive is stored: no card number, expiry or CVC on disk or in logs; the order keeps the last four digits only.
- Orders are self-contained history: lines snapshot SKU, name and unit price, so catalog edits and deletions never rewrite an order.
- The cart, checkout and order pages follow the states and typography already in place; no new UI vocabulary.

**Non-Goals:**

- Customer accounts, authentication, addresses, shipping, taxes, discounts, multiple currencies, e-mail receipts.
- A server-side cart, cart expiry, or holding stock while items sit in the cart. Stock is reserved at checkout only.
- Refunds, cancellations, order editing, retrying payment on an existing order (a declined checkout creates a new order on the next attempt).
- A real provider integration, webhooks, or asynchronous payment states beyond the in-request `pending`.
- A background sweeper for orders left `pending` by a crash between reservation and settlement (see Risks).

## Decisions

### D1. Reserve → charge → settle, in two transactions

`PlaceOrder` runs three steps:

1. `orders.reserve(draft)` — one interactive transaction: for each item, a conditional decrement `UPDATE "Product" SET stock = stock - q WHERE id = ? AND "deletedAt" IS NULL AND stock >= q` (`prisma.product.updateMany` with those conditions); an item whose update touched zero rows is re-read to report `available` (`0` when missing or deleted) and `reason`; if any item failed, throw `UnavailableItemsError` (the transaction rolls back every decrement); otherwise create the `Order` with status `pending` and its lines snapshotted from the products read inside the same transaction.
2. `payments.charge({ orderId, amount, card })` outside any transaction.
3. `orders.settle(orderId, result)` — one transaction: on `approved`, set `paid` and the reference; on `declined`, set `payment_failed`, the reason, and increment each line's product stock back.

Holding the reservation transaction open across the provider call would keep row locks for the duration of an external request; splitting it is the standard pattern and is what makes "reservation" a real state. The conditional `UPDATE` is atomic per row under PostgreSQL's row lock, so two concurrent orders for the last unit cannot both succeed — the second one's `WHERE stock >= q` re-evaluates after the first commits. Items are processed sorted by `productId` so two orders touching the same products lock them in the same order and cannot deadlock.

*Alternatives:* `SELECT … FOR UPDATE` through `$queryRaw` then plain updates — same guarantee with raw SQL and a second round trip; the conditional update expresses the invariant in one statement. A single transaction around the charge — simpler, rejected for the lock-holding reason above. Optimistic `version` column — adds a column and a retry loop for a problem the row lock already solves.

### D2. A declined payment is an outcome, not an error

`POST /orders` responds `201` with the order whether the payment was approved or declined; `status` is `paid` or `payment_failed`. The order was created and is visible at `GET /orders/{id}`, which is what `201` means; the decline is the provider's business answer and the history should show it. Insufficient stock, by contrast, creates nothing and is a `409` with the problem items.

*Alternative:* `402 Payment Required` for a decline. Rejected: the client would have to fish the order out of an error body, and TanStack's `onError` would carry a successful write.

### D3. `PaymentGateway` port with a deterministic fake adapter

```ts
interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>
}
type ChargeResult =
  | { outcome: 'approved'; reference: string }
  | { outcome: 'declined'; reason: string }
```

`infra/payments/fake-payment-gateway.ts` decides by card number: `4000000000000002` → declined "Your card was declined", `4000000000009995` → declined "Your card has insufficient funds", anything else → approved with reference `fake_<random>`. These are the widely known test numbers, so nobody has to learn new ones, and they pass the Luhn check the schema enforces. The reason is a sentence stored and shown verbatim; a code table shared by API and web would be a second vocabulary for two cases.

If `charge` throws, `PlaceOrder` settles the order as `payment_failed` with reason "Payment provider unavailable" and returns it — the reservation must not leak.

*Alternative:* random outcomes — not reproducible in tests or demos. Always approve — the release path would be untested code.

### D4. Data model

```
enum OrderStatus { pending paid payment_failed }

model Order {
  id               String      @id @default(uuid(7)) @db.Uuid
  status           OrderStatus
  customerName     String
  customerEmail    String
  total            Decimal     @db.Decimal(12, 2)
  cardLast4        String
  paymentReference String?
  declineReason    String?
  createdAt        DateTime    @default(now()) @db.Timestamptz()
  updatedAt        DateTime    @updatedAt @db.Timestamptz()
  lines            OrderLine[]
  @@index([createdAt])
}

model OrderLine {
  id        String  @id @default(uuid(7)) @db.Uuid
  orderId   String  @db.Uuid
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String  @db.Uuid
  product   Product @relation(fields: [productId], references: [id])
  sku       String
  name      String
  unitPrice Decimal @db.Decimal(12, 2)
  quantity  Int
  lineTotal Decimal @db.Decimal(12, 2)
  @@index([orderId])
  @@index([productId])
}
```

Lines are a table, not JSON as on `ImportJob`: they reference products (the FK is what the soft-delete decision was made for) and `itemCount` / product sales are natural queries. `productId` keeps the default `Restrict` on delete, which never fires because products are soft-deleted. Card data beyond `cardLast4` never reaches the repository: the use case builds the order draft without it and passes the card only to the gateway.

Totals are computed in the domain in integer cents (`Math.round(price * 100)`) and converted back, so `3 × 19.99` is `59.97` and not `59.970000000000006`; `domain/order/order.ts` exposes `computeTotals(lines)` and is unit-tested.

### D5. Errors

`domain/shared/domain-error.ts` gains `UnavailableItemsError` carrying `items: { productId, requested, available, reason }[]`; `DomainExceptionFilter` maps it to `409 { message, items }`. It is a separate class from `ConflictError` (`field`/`value`) because the body shape differs and the web app branches on it. `GET /orders/{id}` uses `NotFoundError('order', id)` as elsewhere.

### D6. API layout

```
apps/api/src/
  domain/order/order.ts                       Order, OrderSummary, OrderLine, OrderStatus, computeTotals
  domain/shared/domain-error.ts               + UnavailableItemsError
  application/ports/order-repository.ts       OrderDraft, ReservedOrder, OrderRepository, ORDER_REPOSITORY
  application/ports/payment-gateway.ts        ChargeRequest, ChargeResult, PaymentGateway, PAYMENT_GATEWAY
  application/orders/place-order.ts           PlaceOrder (reserve → charge → settle)
  application/orders/list-orders.ts, get-order.ts
  application/orders/__fakes__/in-memory-order-repository.ts   reserves against the in-memory product fake
  application/orders/__fakes__/fake-payment-gateway.ts         scripted outcomes for unit tests
  infra/payments/fake-payment-gateway.ts      the deterministic adapter bound in production
  infra/persistence/prisma/prisma-order.repository.ts, order-mapper.ts
  infra/http/orders/orders.controller.ts, orders.module.ts, order-id.pipe.ts
```

`OrdersModule` binds `ORDER_REPOSITORY` → `PrismaOrderRepository`, `PAYMENT_GATEWAY` → `FakePaymentGateway`, and builds the use cases with `useFactory`, as `ImportsModule` does. `OrdersController`: `POST /orders` (`ZodValidationPipe(placeOrderSchema)`, `201`), `GET /orders`, `GET /orders/:id` (`OrderIdPipe`).

### D7. Shared schemas

`packages/shared/src/order/order.schema.ts`:

- `orderItemSchema` (`productId` uuid, `quantity` int 1–100), `checkoutCustomerSchema`, `paymentCardSchema` (`cardholderName`; `cardNumber` stripped of spaces, 13–19 digits, Luhn; `expiry` `MM/YY` not before the current month; `cvc` 3–4 digits) and `placeOrderSchema` (`items` 1–50 with a `superRefine` rejecting a repeated `productId`, `customer`, `card`).
- `orderStatuses`, `orderLineSchema`, `orderResponseSchema`, `orderSummarySchema`, `unavailableItemSchema` and the `409` body schema, with inferred types.

`cardNumber` is transformed to its digits so the API and the form agree on the stored last four; the raw value with spaces is what the user typed and never leaves the form.

### D8. Web

- **Cart store** — `src/lib/cart-store.ts`: a module-level store over `localStorage` key `cart` (`{ productId, sku, name, unitPrice, quantity }[]`, snapshots for display only) read through `useSyncExternalStore` with an empty server snapshot, so prerendering and hydration agree. Operations: `add(product, quantity)`, `setQuantity`, `remove`, `clear`, `applyUnavailable(items)`; every `localStorage` access is guarded so a blocked storage degrades to an in-memory cart.
- **Entry points** — `AddToCartButton` (`src/components/cart/add-to-cart-button.tsx`) used in the products table (compact, quantity 1) and on the detail page next to a quantity `Input` bounded by `stock`; disabled with `Out of stock` when `stock` is `0`. `Edit`/`Delete` stay where they are.
- **Header** — `links` gains `Orders`; a `CartLink` client component renders `Cart` with the item count in mono, count omitted when empty.
- **`/cart`** — `CartPage`: lines `Table` (name → detail link, unit price, quantity input, line total, remove), total in the spec-sheet style, `Checkout` button; empty state with a link to products.
- **`/checkout`** — `CheckoutPage`: order summary aside; `CheckoutForm` with `zodResolver(placeOrderSchema)` over `customer` and `card` (items come from the store); `useMutation(placeOrder)`. On `paid`: `clear()`, invalidate `productKeys.all` and `orderKeys.all`, `router.push('/orders/[id]')`. On `payment_failed`: alert with the reason and a link to the order, cart and form untouched. On `409`: `applyUnavailable(items)`, alert naming each item. On `400`: field errors as `ProductForm` does. Empty cart renders the cart's empty state.
- **`/orders`** — `OrdersPage`: `Table` with short code (`formatShortId`), date, customer, items, total, status `Badge`; skeleton/empty/error states; rows link to the order.
- **`/orders/[id]`** — `OrderPage`: heading with the short code, status badge, customer and payment in the spec-sheet grid, lines table, total; not-found state.
- `src/lib/orders-api.ts` (`placeOrder`, `listOrders`, `getOrder`, `orderKeys`).

### D9. Tests

- Shared: `order.schema.test.ts` — Luhn pass/fail, spaces stripped, expiry past/present/malformed, quantity bounds, item count bounds, duplicate product, email.
- API unit (`application/orders/orders.test.ts`, fakes): paid path decrements stock and snapshots prices; declined path restores stock and records the reason; provider throwing settles as failed; short and unavailable items produce a `409` listing every problem and leave stock intact; totals to the cent; list newest first; get 404. `domain/order/order.test.ts` for `computeTotals`.
- API integration: `test/prisma-order.repository.integration.test.ts` — reserve rolls back every decrement when one item is short; settle restores stock; `Promise.all` of three reservations on `stock` `1` yields one success and `stock` `0`. `test/orders.integration.test.ts` — the HTTP scenarios of the spec end to end, including that `GET /orders/{id}` carries no card number and that an order outlives its product's deletion.
- Web: `cart-store.test.ts`; `add-to-cart-button.test.tsx`; `cart-page.test.tsx`; `checkout-page.test.tsx` (posts the body without the raw card spaces, navigates on `paid`, shows the decline and keeps the cart, adjusts the cart on `409`, blocks invalid input); `orders-page.test.tsx`; `order-page.test.tsx`; `site-header.test.tsx` extended with `Orders` and the cart count.

## Risks / Trade-offs

- [A crash between reserve and settle leaves an order `pending` with stock held] → the window is one in-process provider call with no I/O beyond it; `pending` is visible in `GET /orders` so it can be spotted. A sweeper that releases reservations older than N minutes is the follow-up if a real provider is ever wired in.
- [Cart snapshots go stale: a price changes after the product was added] → the cart shows its snapshot, the order uses the catalog price; the order page is the receipt. Refreshing snapshots on the cart page is a possible later step.
- [The `409` shape adjusts the cart silently] → the checkout page names every adjusted item before the user submits again.
- [`localStorage` unavailable (private mode, blocked storage)] → the store falls back to memory for the session; the cart simply does not survive a reload.
- [The Luhn check rejects a real but unusual card] → the provider is fake; the check exists to catch typos in the demo and matches what the test numbers satisfy.
- [`expiry` validation depends on the current date] → tests use `12/99`; the schema takes the current date from a single `now` argument defaulting to `new Date()` so it can be pinned.

## Migration Plan

Additive migration `orders` creating the enum, `Order` and `OrderLine`; applied by `prisma migrate deploy` on startup. `test/support/db.ts` truncates `Order` and `OrderLine` too. Rollback is dropping the two tables and the enum; no existing table changes.
