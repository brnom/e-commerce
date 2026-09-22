# Proposal

## Why

The purchase flow works but feels unfinished next to the rest of the web app. Placing an order takes six typed fields even though the payment provider is a fake with three known outcomes; the add-to-cart controls give no visual response on hover or press; the product page's buy box is a bare number input beside a button; and removing a cart line happens on a single click with no confirmation, in a table whose controls do not even show a pointer cursor. The catalog pages set a standard — pressed states, confirmed destructive actions, mono figures — that the new pages should meet.

## What Changes

- Interactive controls across the web app gain a pointer cursor, a hover state and a pressed state, defined once in the button primitive so every button, dialog action, pagination link and sortable header inherits them.
- The add-to-cart control shows a transient "Added" confirmation and, in the products table, fills black on hover; the header's cart count animates when it changes.
- The product page's buy box becomes a real purchase panel: a quantity stepper (decrease, input, increase) bounded by the stock, the stock figure, a full-width add action and, once something was added, a link to the cart.
- The cart page uses the same stepper for line quantities, highlights the hovered line, and asks for confirmation in a dialog before removing a line.
- The checkout is one click by default: the customer fields come pre-filled with a sample customer, and the card section is a dropdown of the provider's test cards — approving card selected by default, the two declining cards, and an "Enter another card" option that reveals the manual fields. A selected test card is shown as a masked card tile; the submit action carries the order total.
- The test cards move to `packages/shared` so the web dropdown and the API's fake gateway read the same list.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `purchase`: the "Cart" requirement gains the stepper, the added confirmation, the cart link after adding and the removal confirmation; the "Checkout user interface" requirement gains the pre-filled customer, the test-card selector with its default and the manual-entry option.
- `web-app-shell`: a new "Interactive control feedback" requirement fixes the cursor, hover and pressed behavior of actionable controls.

## Impact

- **Shared (`packages/shared`):** new `order/test-cards.ts` exporting the test card list (number, outcome, decline reason).
- **API (`apps/api`):** `infra/payments/fake-payment-gateway.ts` reads the declined numbers from the shared list instead of its own constants; behavior unchanged.
- **Web (`apps/web`):** `ui/button.tsx` and `ui/select.tsx` (cursor and pressed states); `cart/add-to-cart-button.tsx`, `cart/cart-link.tsx`, `cart/cart-page.tsx`, `cart/checkout-page.tsx`; new `cart/quantity-stepper.tsx`, `cart/remove-line-dialog.tsx`, `cart/test-card-select.tsx`; `products/product-detail-page.tsx` (buy box); tests updated alongside.
- **Repository:** README "Purchase" section describes the pre-filled checkout and the card dropdown; a "Purchase" decision records why the demo path is one click; the Status table gains the `purchase-ux` row.
- **Sequencing:** this change modifies requirements that `purchase` adds, so `purchase` is archived first; `purchase-ux` is applied on its own branch and archived after it.
