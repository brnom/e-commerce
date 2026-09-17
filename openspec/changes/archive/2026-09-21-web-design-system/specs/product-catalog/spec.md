# Spec Delta

## ADDED Requirements

### Requirement: Product detail page
The web application SHALL provide a page for one product at `/products/{id}` that shows the product's name, price, description, SKU, category, stock, weight and creation and update timestamps, with actions to edit the product and to delete it after confirmation. A deleted or unknown id SHALL show a not-found state.

#### Scenario: Detail shows every field
- **WHEN** a user opens the detail page of an existing product
- **THEN** the page shows its name, price, description, SKU, category, stock and weight, and offers `Edit` and `Delete`

#### Scenario: Deleted product has no detail
- **WHEN** a user opens the detail page of a product that was deleted
- **THEN** the page shows a not-found state and a link back to the products page

#### Scenario: Delete from the detail page
- **WHEN** a user confirms deletion on the detail page
- **THEN** the product is deleted and the products page opens without it

## MODIFIED Requirements

### Requirement: Catalog user interface
The web application SHALL provide a products page that lists products with their SKU, name, category, price and stock, with a search box, a category filter fed by `GET /categories`, sortable columns and page navigation; a form to create a product; a form to edit an existing product; and a delete action that asks for confirmation in a dialog. Each product's name in the list SHALL link to its detail page. Forms SHALL validate with the same rules as the API and show field-level messages before submitting. Product text SHALL be rendered as text, never interpreted as markup.

#### Scenario: Search from the list page
- **WHEN** a user types `mouse` in the search box on the products page
- **THEN** the list shows only products whose name or description contains `mouse`, and the total count reflects the filter

#### Scenario: Form blocks invalid submission
- **WHEN** a user submits the create form with an empty name and a price of `-1`
- **THEN** the form shows a message next to the name field and next to the price field, and no request is sent to the API

#### Scenario: API validation error is shown on the form
- **WHEN** a user submits the create form with a SKU that already exists
- **THEN** the form shows the conflict message returned by the API next to the SKU field

#### Scenario: Deletion requires confirmation
- **WHEN** a user clicks delete on a product and cancels the confirmation dialog
- **THEN** the product remains in the list and no request is sent to the API

#### Scenario: Name links to the detail page
- **WHEN** a user activates a product's name in the list
- **THEN** that product's detail page opens

#### Scenario: Markup in product fields is displayed literally
- **WHEN** a product whose name is `<script>alert('xss')</script>` is listed
- **THEN** the page shows that text verbatim and no script is executed
