# Spec Delta

## ADDED Requirements

### Requirement: Interactive control feedback
Every control that triggers an action — buttons, dialog actions, pagination links, sortable headers, select triggers and items, add-to-cart and remove actions — SHALL show a pointer cursor, a visible hover state and a visible pressed state, with transitions no longer than 200 ms. A disabled control SHALL show neither the pointer nor the hover state. The header's cart count SHALL animate when it changes.

#### Scenario: Button answers hover and press
- **WHEN** a pointer moves over an enabled button and presses it
- **THEN** the cursor is a pointer, the background changes on hover and changes again while pressed

#### Scenario: Disabled control gives no feedback
- **WHEN** a pointer moves over a disabled add-to-cart control
- **THEN** the cursor is not a pointer and the control's appearance does not change

#### Scenario: Cart count bumps
- **WHEN** a product is added to the cart while the header is visible
- **THEN** the cart count re-enters with a short zoom animation showing the new value
