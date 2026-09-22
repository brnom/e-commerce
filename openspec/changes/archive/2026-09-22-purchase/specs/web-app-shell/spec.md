# Spec Delta

## MODIFIED Requirements

### Requirement: Global navigation
Every page SHALL render a header containing the application wordmark linking to the home page, links to the products page, to the imports page and to the orders page, a cart link showing the number of items in the cart (hidden when the cart is empty), and the API status indicator; and a footer. The home page SHALL present the application name and a primary action leading to the products page.

#### Scenario: Header on every page
- **WHEN** a user opens the home page, the products page, a product's detail page, a product form, the imports page, an import report, the cart, the checkout, the orders page or an order's page
- **THEN** the same header with the wordmark, the `Products`, `Imports` and `Orders` links, the cart link and the API status is visible at the top

#### Scenario: Home leads to the catalog
- **WHEN** a user activates the primary action on the home page
- **THEN** the products page opens

#### Scenario: Header leads to imports
- **WHEN** a user activates the `Imports` link in the header
- **THEN** the imports page opens

#### Scenario: Header leads to orders
- **WHEN** a user activates the `Orders` link in the header
- **THEN** the orders page opens

#### Scenario: Cart link shows the item count
- **WHEN** the cart holds two lines with quantities `1` and `2`
- **THEN** the header's cart link shows `3` and activating it opens the cart page
