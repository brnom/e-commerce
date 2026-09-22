# Spec Delta

## MODIFIED Requirements

### Requirement: Cart
The web application SHALL keep a cart in the browser that survives page reloads. The products page and the product detail page SHALL offer an add-to-cart action for each product with stock, disabled with an out-of-stock label when `stock` is `0`; after adding, the action SHALL show a transient added confirmation and the header's cart indicator SHALL update. The detail page SHALL let the user choose the quantity with a stepper (decrease, input, increase) bounded from 1 to the product's stock, show the stock figure, and, once a product was added from that page, offer a link to the cart. Adding a product already in the cart SHALL increase its quantity. The cart page at `/cart` SHALL list every line with the product name linking to its detail page, unit price, a quantity stepper, line total and a remove action that asks for confirmation in a dialog before the line is removed; show the cart total; offer a checkout action; and show an empty state leading to the products page when the cart is empty.

#### Scenario: Add from the detail page
- **WHEN** a user presses increase once on a product's detail page and activates add to cart
- **THEN** the control shows `Added`, the header's cart indicator shows `2`, a link to the cart appears in the buy box, and the cart page lists that product with quantity `2`

#### Scenario: Stepper is bounded by the stock
- **WHEN** a product with `stock` `3` is shown on its detail page and the quantity is `3`
- **THEN** the increase control is disabled, and typing `7` in the quantity input snaps back to `3` when the input loses focus

#### Scenario: Adding twice accumulates
- **WHEN** a product is in the cart with quantity `1` and the user adds it again from the products page
- **THEN** the cart shows that product once with quantity `2`

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
