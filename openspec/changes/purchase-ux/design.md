# Design

## Context

See proposal.md — Why. The web app's controls come from shadcn/ui files under `src/components/ui`, so a style that belongs to every button is one edit in `button.tsx`. Tailwind v4 dropped the pointer cursor from buttons by default, which is why nothing in the app shows one. The cart is a `localStorage`-backed store (`cart-store.ts`); the checkout form is `react-hook-form` over `placeOrderSchema`, and the API's fake gateway decides by card number. The product delete flow already shows the pattern for a confirmed destructive action (`DeleteProductDialog`: Radix alert dialog, danger hover on the trigger and the action).

## Goals / Non-Goals

**Goals:**

- Every actionable control answers hover and press the same way, app-wide, without touching each call site.
- Buying is the shortest path in the app: open the checkout, press one button.
- Nothing about validation, the request body or the API changes; the polish is entirely in the presentation and in what the form starts with.
- Black, white and one gray; the card tile is the only new visual element and it is typographic.

**Non-Goals:**

- Toasts, undo, or a notification system; the confirmation dialog is the feedback for removal.
- Saving customer details, remembering the last card, or any customer concept.
- Animations beyond the short transitions already provided by `tw-animate-css`.
- Changing the cart's storage, the order schema or any endpoint.

## Decisions

### D1. Feedback states live in the button primitive

`buttonVariants` gains `cursor-pointer` and a pressed transform (`active:scale-[0.98]`) in its base, and each variant gains an `active:` background one step darker than its hover (`default` → `active:bg-primary/80`, `outline` and `ghost` → `active:bg-border/60`, `destructive` → `active:bg-destructive/80`). `SelectTrigger` and `SelectItem` gain `cursor-pointer`. Everything built on these — dialog actions, pagination, sort headers, the delete triggers — inherits the states.

*Alternative:* a global `button { cursor: pointer }` rule — covers the cursor only and reaches disabled buttons too; the variant file is where the other states already are.

### D2. One `QuantityStepper` for the buy box and the cart

`components/cart/quantity-stepper.tsx`: a decrease button, a numeric input and an increase button in one bordered group, with `value`, `min` (1), optional `max` and `onChange`. The buttons are disabled at the bounds; typing is accepted while the draft is invalid and snapped back on blur, as the current inputs do. Labels are `Decrease quantity`, `Quantity of <name>` and `Increase quantity`. The buy box uses `max = stock`; the cart line uses `max = 100`, the per-line limit `placeOrderSchema` enforces, since the cart does not know the stock.

*Alternative:* keep the number input — the browser spinner is the only affordance and it is invisible until hover.

### D3. Removal confirms, like deletion

`RemoveLineDialog` wraps the trash button in the same alert dialog shape as `DeleteProductDialog` ("Remove from cart?", the product name, Cancel / Remove with the danger hover). The trigger keeps its `Remove <name>` label so the existing tests and screen readers find it; the confirming action is labelled `Remove` inside the dialog.

*Alternative:* remove immediately and offer undo — needs a toast surface the app does not have, for a cart of a few lines.

### D4. Add-to-cart feedback

`AddToCartButton` keeps its three states (idle, added, out of stock). While added it swaps the cart icon for a check and fills black (`bg-foreground text-background`) for 1.5 s, entering with `animate-in fade-in zoom-in-95`. In the table it is an `outline` button whose hover fills black; in the buy box it is the default black button. `CartLink` re-mounts its badge on every count change (`key={count}`) with a `zoom-in` entrance so the header bumps when something is added. The buy box shows `Added — View cart` under the button after the first add on that page.

### D5. Test cards in the shared package

`packages/shared/src/order/test-cards.ts`:

```ts
export const testCards = [
  { id: 'approved', label: 'Approved', number: '4242424242424242', outcome: 'approved' },
  { id: 'declined', label: 'Declined', number: '4000000000000002', outcome: 'declined', declineReason: 'Your card was declined' },
  { id: 'insufficient_funds', label: 'Insufficient funds', number: '4000000000009995', outcome: 'declined', declineReason: 'Your card has insufficient funds' },
] as const
```

The fake gateway looks the number up in this list and approves anything not listed; the web dropdown renders it. One list, one place to add a fourth outcome.

*Alternative:* duplicate the numbers in the web app — the README already lists them a third time.

### D6. The checkout starts filled and the card is a selector

`CheckoutPage` initializes the form with `sampleCustomer` (`Ada Lovelace`, `ada@example.com`) and the approving test card. The card fieldset holds a `Select` labelled `Card` with one item per test card plus `Enter another card`. Selecting a test card sets `card.cardNumber` to its number, `card.cardholderName` to the customer's name, `card.expiry` to December three years from now (`MM/YY`, always valid for the schema) and `card.cvc` to `123`, and renders a tile — black background, the masked number `•••• •••• •••• 4242` in mono, the holder and expiry — in place of the inputs. Selecting `Enter another card` clears the four card fields and shows the inputs. While a test card is selected, `card.cardholderName` follows edits to the customer name. The form values stay the single source of truth, so validation, the digits-only submission and the `400` field-error mapping are unchanged; card errors returned while a test card is selected are listed under the tile.

The submit button reads `Place order · <total>` so the amount is next to the action; the summary aside is sticky on wide screens.

*Alternatives:* a "Fill test card" button next to empty inputs — two clicks and no way to see the outcome before pressing; a separate demo toggle — the provider is always fake here, the selector is the honest UI for it.

## Risks / Trade-offs

- **A pre-filled form can be submitted by mistake.** The cart page still sits between the catalog and the checkout, and the order is a demo order against a fake provider; the README says so.
- **Real deployments would remove the selector.** The tile and selector are one component (`TestCardSelect`); swapping it for the manual fields is deleting a branch, not rewriting the form.
- **`active:scale` on `asChild` links** — the transform applies to the anchor, which is fine; it must not apply to the `link` variant, which stays text.

## Migration Plan

None: no schema, storage or endpoint changes. The cart in `localStorage` keeps its shape.

## Open Questions

None.
