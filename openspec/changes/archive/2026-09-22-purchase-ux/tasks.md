# Tasks

## 1. Shared test cards

- [x] 1.1 Add `packages/shared/src/order/test-cards.ts` exporting `testCards` (`id`, `label`, `number`, `outcome`, `declineReason?`) with the approving, declined and insufficient-funds cards and a `TestCard` type; export from `index.ts`; rebuild shared and verify `pnpm --filter @ecommerce/shared test` and both app typechecks pass
- [x] 1.2 Make `apps/api/src/infra/payments/fake-payment-gateway.ts` decide from `testCards` (declined entries by number, anything else approved) and drop its local constants; verify `fake-payment-gateway.test.ts` still covers the three outcomes and passes

## 2. Interactive feedback primitives

- [x] 2.1 In `ui/button.tsx` add `cursor-pointer` and `active:scale-[0.98]` to the base classes (keeping `disabled:pointer-events-none`), an `active:` background per variant (`default`, `outline`, `ghost`, `secondary`, `destructive`; `link` stays text-only) and `transition-[color,background-color,border-color,transform]`; in `ui/select.tsx` add `cursor-pointer` to `SelectTrigger` and `SelectItem`; verify `pnpm --filter web lint` and typecheck pass and the products page, dialogs and pagination show the states in the browser
- [x] 2.2 In `cart/cart-link.tsx` re-mount the count badge on every change (`key={count}`) with `animate-in zoom-in-50 duration-200`; verify `site-header.test.tsx` still passes

## 3. Add to cart and buy box

- [x] 3.1 Rework `cart/add-to-cart-button.tsx`: added state swaps the icon for `Check`, fills `bg-foreground text-background` with `animate-in fade-in zoom-in-95`, and the table usage becomes `variant="outline"` with a black hover (`hover:bg-foreground hover:text-background hover:border-foreground`); verify `add-to-cart-button.test.tsx` covers the `Added` label after a click and the disabled out-of-stock state, and `products-table.test.tsx` passes
- [x] 3.2 Add `cart/quantity-stepper.tsx` (`value`, `min = 1`, `max?`, `onChange`, `name` for the labels; decrease/increase buttons disabled at the bounds, input draft snapped on blur); verify `quantity-stepper.test.tsx` covers increase, decrease, the bounds and the snap-back
- [x] 3.3 Rebuild `BuyBox` in `products/product-detail-page.tsx`: stepper bounded by `stock`, the stock figure in mono, a full-width `size="lg"` add action, and an `Added — View cart` link shown after the first add; out of stock shows the disabled control and no stepper; verify `product-detail-page.test.tsx` covers adding quantity `2` via the stepper, the cart link appearing, and the out-of-stock state

## 4. Cart page

- [x] 4.1 Add `cart/remove-line-dialog.tsx` (alert dialog titled `Remove from cart?`, naming the product, `Cancel` / `Remove` with the danger hover; trigger labelled `Remove <name>`) and use it in `CartLinesTable`; replace the quantity input with `QuantityStepper` (`max = 100`); keep the row hover from the table primitive; verify `cart-page.test.tsx` covers the stepper edit, cancelling the dialog keeping the line, confirming removing it, and the empty state

## 5. Checkout

- [x] 5.1 Add `cart/test-card-select.tsx`: a `Select` labelled `Card` over `testCards` plus `Enter another card`; a black card tile (masked number in mono, holder, expiry) while a test card is selected; the manual inputs otherwise; `onChange` reports the selected id; verify the tile shows `•••• •••• •••• 4242` and the manual option shows the four inputs
- [x] 5.2 In `cart/checkout-page.tsx` initialize the form with `sampleCustomer` and the approving card (expiry `12/YY` three years ahead, cvc `123`), wire the selector (setting the card fields on change, clearing them for manual, keeping `cardholderName` in sync with the customer name while a test card is selected), list card field errors under the tile, label the submit `Place order · <total>` and make the summary aside sticky on `lg`; verify `checkout-page.test.tsx` covers the one-click paid order with the sample customer and `4242424242424242` in the body, the declined selector keeping the cart, the manual card typed and sent as digits, the `409` adjustment, and the blocked submission with a cleared email and card number `1234`
- [x] 5.3 Run `pnpm --filter web test`, `pnpm --filter web lint` and `pnpm --filter web typecheck` and verify all pass

## 6. Docs and final check

- [x] 6.1 Update `README.md`: the "Purchase" section says the checkout starts with a sample customer and the approving test card selected in a dropdown, with the other cards and a manual option; add a "Purchase" decision — **The checkout is one click by default** (fake provider, three known outcomes, the selector is the honest UI for it; rejected: typing a card everyone copies from the README, a hidden demo toggle) — and the `purchase-ux` row of the Status table
- [x] 6.2 Run `pnpm check` at the root and verify every task is green
- [ ] 6.3 With `pnpm dev`, walk the flow in the browser: hover and press states on the products table, add from the table and from the buy box, the header bump, the cart removal dialog, and a one-click checkout followed by a declined one from the selector
