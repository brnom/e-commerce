# Proposal

## Why

The catalog can be managed and searched, but nothing can be bought: there is no way to turn products into an order, take a payment or reduce stock. Purchase is the last feature the product brief requires, and it is the one that gives the earlier decisions their point — soft-deleted products were kept so that order lines resolve, and PostgreSQL was chosen for transactional stock reservation.

## What Changes

- Add a cart to the web app: products are added from the list and from the detail page, the cart lives in the browser and shows its lines with quantities and a total, and its item count is visible in the header.
- Add a checkout: a page that takes the customer's name and email and card details, and places one order for every line in the cart.
- Add orders to the API: `POST /orders` reserves stock for every line atomically, charges the payment provider and records the outcome; a declined payment releases the stock. Insufficient stock or an unavailable product rejects the whole order and names each problem item, so nothing is partially sold.
- Add a fake payment provider behind a port: deterministic test card numbers approve or decline, so the decline path can be demonstrated and tested. The card number and security code are never stored; only the last four digits are.
- Every order snapshots the SKU, name and unit price of each line at purchase time, so later price changes or deletions do not rewrite history.
- Add an `Orders` area to the web app: a confirmation page per order and a history list, with the same states as the imports pages. The global navigation gains `Orders` and `Cart`.

## Capabilities

### New Capabilities

- `purchase`: buying products — the cart, the order placed from it, the validation of its items and payment details, atomic stock reservation and release, the fake payment provider's behavior, the order record with its snapshot lines, and the cart, checkout and order pages.

### Modified Capabilities

- `web-app-shell`: the "Global navigation" requirement gains the `Orders` link and the cart indicator in the header.

_`product-catalog` is unchanged: its validation, listing and soft-delete rules stay as they are. The add-to-cart entry points on the products page and the product detail page are specified under `purchase`, and the stock a purchase decrements is the same `stock` field the catalog already exposes._

## Impact

- **Database:** new migration creating `Order` and `OrderLine` (with an `OrderStatus` enum). `Product` gains the reverse relation only; its columns are untouched.
- **API (`apps/api`):** new `domain/order`, `application/orders` use cases, an `OrderRepository` port that owns the reserve and settle transactions, a `PaymentGateway` port with a fake adapter under `infra/payments`, a new `infra/http/orders` controller, and a new domain error mapped to `409`.
- **Shared (`packages/shared`):** new `order` module with the checkout request schema (items, customer, card with Luhn check and expiry), the order response schemas and the `409` body schema.
- **Web (`apps/web`):** new routes `/cart`, `/checkout`, `/orders` and `/orders/[id]`; a browser-persisted cart store; add-to-cart controls on the products table and the product detail page; `Orders` and cart links in the header.
- **Repository:** README gains a "Purchase" section (flow, test cards, endpoints), "Purchase" decisions and the status row update.
- **Later changes:** none planned; this completes the product brief.
