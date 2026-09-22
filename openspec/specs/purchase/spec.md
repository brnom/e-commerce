# purchase Specification

## Purpose

Defines how products are bought: the cart a shopper fills, the order placed from it, how stock is reserved and released, how the payment provider is asked to charge and how its answer is recorded, and the pages that show the cart, take the payment and present past orders.

## Requirements

### Requirement: Checkout request validation
An order request SHALL carry `items` (1 to 50 entries, each with a product `productId` and an integer `quantity` of at least 1, with no upper limit other than the product's stock; a product SHALL appear at most once), a `customer` (`name`, 1–100 characters after trimming; `email`, a valid address of at most 254 characters) and a `card` (`cardholderName`, 1–100 characters after trimming; `cardNumber`, 13–19 digits once spaces are removed, passing the Luhn check; `expiry` as `MM/YY` with a month from `01` to `12` that is not earlier than the current month; `cvc`, 3 or 4 digits). A request that violates any rule SHALL be rejected with status `400` and a body listing every failing field with a message, and no order SHALL be recorded and no stock SHALL change. The same rules SHALL be enforced by the checkout form before a request is sent.

#### Scenario: Card number failing the Luhn check
- **WHEN** an order request has `cardNumber` `4242 4242 4242 4241`
- **THEN** the response is `400` and the issues list contains an entry whose path is `card.cardNumber`

#### Scenario: Spaces in the card number are accepted
- **WHEN** an order request has `cardNumber` `4242 4242 4242 4242` and every other field valid
- **THEN** the request is accepted

#### Scenario: Expired card
- **WHEN** an order request has `expiry` `01/20`
- **THEN** the response is `400` and the issues list contains an entry whose path is `card.expiry`

#### Scenario: Quantity out of range
- **WHEN** an order request has an item with `quantity` `0`
- **THEN** the response is `400` and the issues list contains an entry whose path names that item's `quantity`

#### Scenario: Same product twice
- **WHEN** an order request lists the same `productId` in two items
- **THEN** the response is `400` and the issues list contains an entry whose path is `items`

#### Scenario: Several invalid fields are reported together
- **WHEN** an order request has an empty customer `name` and a `cvc` of `12`
- **THEN** the response is `400` and the issues list contains one entry for `customer.name` and one for `card.cvc`

### Requirement: Stock reservation
Placing an order SHALL reserve stock for every item as one unit: each item's product SHALL exist and not be deleted, and SHALL have at least the requested quantity in stock; when every item qualifies, each product's `stock` SHALL be reduced by its quantity, and when any item does not, no product's stock SHALL change and no order SHALL be recorded. The rejection SHALL respond `409` with a body listing every problem item with its `productId`, the `requested` quantity, the `available` stock (`0` for an unknown or deleted product) and a `reason` of `insufficient_stock` or `unavailable`. Concurrent orders for the same product SHALL never reduce its stock below zero.

#### Scenario: Stock is reduced by the order
- **WHEN** a product has `stock` `5` and an order with `quantity` `2` for it is placed and paid
- **THEN** `GET /products/{id}` shows `stock` `3`

#### Scenario: One short item rejects the whole order
- **WHEN** product `A` has `stock` `10`, product `B` has `stock` `1`, and an order requests `2` of `A` and `3` of `B`
- **THEN** the response is `409`, the body lists only `B` with `requested` `3`, `available` `1` and `reason` `insufficient_stock`, `A` still has `stock` `10` and `GET /orders` is unchanged

#### Scenario: Deleted product cannot be bought
- **WHEN** an order requests a product that was deleted
- **THEN** the response is `409` and the body lists that product with `available` `0` and `reason` `unavailable`

#### Scenario: Unknown product id
- **WHEN** an order requests a `productId` that was never created
- **THEN** the response is `409` and the body lists that id with `available` `0` and `reason` `unavailable`

#### Scenario: Concurrent orders do not oversell
- **WHEN** a product has `stock` `1` and three orders for `1` of it are placed at the same time
- **THEN** exactly one order is recorded as `paid`, the other two receive `409`, and the product's `stock` is `0`

### Requirement: Payment and settlement
After stock is reserved, the system SHALL ask the payment provider to charge the order's total for the given card. When the provider approves, the order SHALL be recorded with status `paid` and the provider's reference. When the provider declines, the order SHALL be recorded with status `payment_failed` and the provider's reason, and every item's stock SHALL be restored to what it was before the reservation. In both cases the response SHALL be `201` with the order; the `status` field carries the outcome. The card number, expiry and security code SHALL NOT be stored or returned; the order SHALL expose only the card's last four digits.

#### Scenario: Approved payment
- **WHEN** an order is placed with card number `4242 4242 4242 4242`
- **THEN** the response is `201` with `status` `paid`, a non-empty `payment.reference`, `payment.declineReason` `null` and `payment.cardLast4` `4242`

#### Scenario: Declined payment releases the stock
- **WHEN** a product has `stock` `5` and an order for `2` of it is placed with card number `4000 0000 0000 0002`
- **THEN** the response is `201` with `status` `payment_failed`, `payment.reference` `null` and a `payment.declineReason` saying the card was declined, and `GET /products/{id}` shows `stock` `5`

#### Scenario: Insufficient funds
- **WHEN** an order is placed with card number `4000 0000 0000 9995`
- **THEN** the response is `201` with `status` `payment_failed` and a `payment.declineReason` saying the card has insufficient funds

#### Scenario: Card details are not persisted
- **WHEN** an order is placed and then fetched with `GET /orders/{id}`
- **THEN** the body contains `payment.cardLast4` and no field carrying the full card number, expiry or security code

### Requirement: Order record
An order SHALL have a generated `id`, a `status` (`pending` while payment is in progress, then `paid` or `payment_failed`), the `customer` (`name`, `email`), one line per item with the product's `productId`, `sku`, `name` and `unitPrice` as they were at the time of purchase, the `quantity` and the `lineTotal`, the order `total` (the sum of line totals, exact to the cent), the `payment` (`cardLast4`, `reference` or `null`, `declineReason` or `null`), `createdAt` and `updatedAt`. Line prices SHALL be taken from the catalog at the time of purchase, never from the request. The system SHALL expose `POST /orders` (`201` with the order), `GET /orders` (every order newest first as summaries with `id`, `status`, `customer`, `itemCount`, `total` and `createdAt`) and `GET /orders/{id}` (`200` with the order; `404` for an unknown id).

#### Scenario: Lines snapshot the catalog
- **WHEN** an order is placed for `3` of a product priced `19.99` and the product's price is then changed to `25.00`
- **THEN** `GET /orders/{id}` still shows that line with `unitPrice` `19.99`, `lineTotal` `59.97` and `total` `59.97`

#### Scenario: Order survives the product's deletion
- **WHEN** an order was placed for a product and that product is later deleted
- **THEN** `GET /orders/{id}` responds `200` with the line's `sku` and `name` intact

#### Scenario: History lists orders newest first
- **WHEN** two orders have been placed
- **THEN** `GET /orders` returns both as summaries with `itemCount` equal to the sum of their quantities, the most recent first, and without `lines`

#### Scenario: Unknown order
- **WHEN** `GET /orders/{id}` is requested with an id that was never created
- **THEN** the response is `404`

### Requirement: Cart
The web application SHALL keep a cart in the browser that survives page reloads. The products page and the product detail page SHALL offer an add-to-cart action for each product with stock, disabled with an out-of-stock label when `stock` is `0`; after adding, the action SHALL show a transient added confirmation and the header's cart indicator SHALL update. The detail page SHALL let the user choose the quantity with a stepper (decrease, input, increase) bounded from 1 to the product's stock, show the stock figure, and, once a product was added from that page, offer a link to the cart. Adding a product already in the cart SHALL increase its quantity, never above the product's stock; once the cart holds all of it, the add-to-cart action SHALL be disabled with an all-in-cart label. The cart page at `/cart` SHALL list every line with the product name linking to its detail page, unit price, a quantity stepper bounded by the product's stock, line total and a remove action that asks for confirmation in a dialog before the line is removed; show the cart total; offer a checkout action; and show an empty state leading to the products page when the cart is empty.

#### Scenario: Add from the detail page
- **WHEN** a user presses increase once on a product's detail page and activates add to cart
- **THEN** the control shows `Added`, the header's cart indicator shows `2`, a link to the cart appears in the buy box, and the cart page lists that product with quantity `2`

#### Scenario: Stepper is bounded by the stock
- **WHEN** a product with `stock` `3` is shown on its detail page and the quantity is `3`
- **THEN** the increase control is disabled, and typing `7` in the quantity input snaps back to `3` when the input loses focus

#### Scenario: Adding twice accumulates
- **WHEN** a product is in the cart with quantity `1` and the user adds it again from the products page
- **THEN** the cart shows that product once with quantity `2`

#### Scenario: Adding again stops at the stock
- **WHEN** a product with `stock` `5` is added to the cart with quantity `5` and the user tries to add it again
- **THEN** the cart keeps that product with quantity `5` and its add-to-cart control is disabled and labelled as all in cart

#### Scenario: Out of stock cannot be added
- **WHEN** a product with `stock` `0` is shown on the products page or its detail page
- **THEN** its add-to-cart control is disabled and labelled as out of stock

#### Scenario: Cart survives a reload
- **WHEN** a user adds a product to the cart and reloads the page
- **THEN** the cart still contains that product

#### Scenario: Removal is confirmed
- **WHEN** a user activates the remove action of a cart line
- **THEN** a dialog names the product and offers cancel and remove; cancelling keeps the line, confirming removes it and updates the total

#### Scenario: Empty cart
- **WHEN** a user opens the cart page with nothing in the cart
- **THEN** the page shows an empty state with a link to the products page and no checkout action

### Requirement: Checkout user interface
The web application SHALL provide a checkout page at `/checkout` that shows the cart lines and total, and a form for the customer's name and email and the card, validated with the same rules as the API before submitting. The customer fields SHALL start filled with a sample customer that the user can edit. The card section SHALL be a selector listing the payment provider's test cards — the approving card selected by default, then each declining card — and an option to enter another card. With a test card selected, the page SHALL show the card as a tile with its masked number (last four digits visible), the cardholder name and the expiry, and SHALL fill the card fields with that card, the customer's name, a future expiry and a security code, so submitting without typing places an order. With the manual option selected, the page SHALL show empty inputs for the card's holder name, number, expiry and security code. The submit action SHALL show the order total. On a `paid` order the cart SHALL be emptied and the order's page SHALL open. On a `payment_failed` order the page SHALL show the decline reason, keep the cart and the form so another card can be tried, and link to the failed order. On a `409` the page SHALL name each unavailable item, remove unavailable products from the cart, lower a short item's quantity to what is available, and let the user submit again. Opening the checkout with an empty cart SHALL show the cart's empty state.

#### Scenario: One-click checkout
- **WHEN** a user with two lines in the cart opens the checkout and activates the submit action without editing anything
- **THEN** the request carries the sample customer and card number `4242424242424242`, the order's page opens showing status `paid`, and the header's cart indicator shows no items

#### Scenario: Declining card from the selector
- **WHEN** a user selects the `Declined` test card and activates the submit action
- **THEN** the request carries card number `4000000000000002`, the page shows the decline reason, the cart still holds its lines, and the form still holds the customer details

#### Scenario: Another card is typed
- **WHEN** a user selects the option to enter another card, fills the holder name, number `4242 4242 4242 4242`, expiry and security code, and activates the submit action
- **THEN** the request carries the typed card with the number as digits only

#### Scenario: Stock changed since the cart was filled
- **WHEN** a user's cart has `3` of a product that now has `1` in stock and the checkout is submitted
- **THEN** the page names that product as short, the cart line's quantity becomes `1`, and the form can be submitted again

#### Scenario: Form blocks invalid submission
- **WHEN** a user clears the email, selects the option to enter another card, types card number `1234` and activates the submit action
- **THEN** the form shows a message next to the email field and next to the card number field, and no request is sent to the API

### Requirement: Orders user interface
The web application SHALL provide an orders page at `/orders` listing every order with its short code (the last eight characters of its `id`, upper-cased), date, customer name, item count, total and status, each linking to the order's page; and an order page at `/orders/{id}` showing the short code, status, customer, payment (card last four digits and the reference or the decline reason), every line with product name, SKU, unit price, quantity and line total, and the total. An unknown id SHALL show a not-found state with a link to the orders page.

#### Scenario: Order page after checkout
- **WHEN** a user opens the page of a paid order
- **THEN** the page shows the status `paid`, the customer name and email, the card's last four digits, every line and the total

#### Scenario: Failed order is visible
- **WHEN** a user opens the orders page after a declined payment
- **THEN** the list includes that order with status `payment_failed`

#### Scenario: Unknown order
- **WHEN** a user opens `/orders/{id}` with an id that does not exist
- **THEN** the page shows a not-found state and a link to the orders page
