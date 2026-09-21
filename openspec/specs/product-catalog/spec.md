# product-catalog Specification

## Purpose

Defines the products a store sells and how they are created, edited, removed, listed and searched, including the validation every product must satisfy and how categories come into existence.

## Requirements

### Requirement: Product validation
A product SHALL have a `sku` (required, 1–64 characters after trimming, stored upper-cased), a `name` (required, 1–200 characters after trimming), an optional `description` (at most 2000 characters), a `price` (decimal, zero or greater, at most two fraction digits), a `stock` (integer, zero or greater), an optional `weightKg` (decimal, zero or greater, at most three fraction digits) and an optional `category` name (1–100 characters after trimming). A create or update request that violates any rule SHALL be rejected with status `400` and a body listing every failing field with a message; nothing SHALL be persisted.

#### Scenario: Blank name is rejected
- **WHEN** a create request has a `name` consisting only of whitespace
- **THEN** the response is `400` and the issues list contains an entry whose path is `name`

#### Scenario: Price with a currency symbol is rejected
- **WHEN** a create request has `price` equal to the string `"$29.99"`
- **THEN** the response is `400` and the issues list contains an entry whose path is `price`

#### Scenario: Negative stock is rejected
- **WHEN** a create request has `stock` equal to `-5`
- **THEN** the response is `400` and the issues list contains an entry whose path is `stock`

#### Scenario: Zero price and missing weight are valid
- **WHEN** a create request has `price` equal to `0` and omits `weightKg`
- **THEN** the product is created with `price` `0` and `weightKg` `null`

#### Scenario: Several invalid fields are reported together
- **WHEN** a create request has a blank `name` and a negative `stock`
- **THEN** the response is `400` and the issues list contains one entry for `name` and one for `stock`

### Requirement: SKU uniqueness
The `sku` SHALL be unique across all products, including deleted ones, compared case-insensitively. A create or update that would produce a duplicate SHALL be rejected with status `409` and a body naming the conflicting SKU, leaving existing data unchanged.

#### Scenario: Duplicate SKU on create
- **WHEN** a product with SKU `RS-001` exists and a create request uses `sku` `"rs-001"`
- **THEN** the response is `409`, the body names `RS-001`, and only one product with that SKU exists

#### Scenario: Update to another product's SKU
- **WHEN** products `A` (SKU `RS-001`) and `B` (SKU `CB-010`) exist and an update sets `B`'s `sku` to `RS-001`
- **THEN** the response is `409` and `B` still has SKU `CB-010`

#### Scenario: Update keeping its own SKU
- **WHEN** an update request for product `A` includes `A`'s current `sku` unchanged
- **THEN** the update succeeds

### Requirement: Categories created on demand
Categories SHALL come into existence from the `category` name supplied on a product, not from a predefined list. When a product is created or updated with a `category` name, the system SHALL reuse an existing category whose name matches case-insensitively after trimming, or create one otherwise. A product response SHALL include its category as an object with `id` and `name`, or `null`. The system SHALL expose `GET /categories` returning every category ordered by name.

#### Scenario: New category name creates a category
- **WHEN** no category named `Footwear` exists and a product is created with `category` `"Footwear"`
- **THEN** the product response has `category.name` equal to `Footwear` and `GET /categories` includes `Footwear`

#### Scenario: Existing category is reused regardless of case
- **WHEN** a category named `Electronics` exists and a product is created with `category` `" electronics "`
- **THEN** the product is linked to the existing `Electronics` category and `GET /categories` still lists `Electronics` once

#### Scenario: Category cleared on update
- **WHEN** an update request sets `category` to `null`
- **THEN** the product response has `category` `null`

### Requirement: Product lifecycle
The system SHALL expose `POST /products` (create, `201` with the created product), `GET /products/{id}` (`200` with the product), `PATCH /products/{id}` (partial update, `200` with the updated product) and `DELETE /products/{id}` (`204`). Every product response SHALL include `id`, `sku`, `name`, `description`, `price`, `stock`, `weightKg`, `category`, `createdAt` and `updatedAt`. Any operation on an id that does not exist SHALL respond `404`.

#### Scenario: Create returns the stored product
- **WHEN** a valid create request is sent with `sku` `"wm-042"`
- **THEN** the response is `201` and the body contains a generated `id`, `sku` `WM-042` and every field that was sent

#### Scenario: Partial update leaves other fields intact
- **WHEN** a product exists and an update request contains only `stock` `12`
- **THEN** the response is `200`, `stock` is `12` and every other field equals its previous value

#### Scenario: Unknown id
- **WHEN** `GET /products/{id}` is requested with an id that was never created
- **THEN** the response is `404`

### Requirement: Soft deletion
Deleting a product SHALL hide it from every read endpoint and from the listing without destroying its record, so that references created later (such as order lines) keep resolving. A deleted product SHALL respond `404` to read, update and a second delete, and its SKU SHALL remain reserved.

#### Scenario: Deleted product disappears from reads and listing
- **WHEN** a product is deleted
- **THEN** `GET /products/{id}` responds `404` and the product is absent from `GET /products` regardless of filters

#### Scenario: Deleting twice
- **WHEN** `DELETE /products/{id}` is sent for a product that was already deleted
- **THEN** the response is `404`

#### Scenario: SKU of a deleted product stays reserved
- **WHEN** a product with SKU `LW-019` is deleted and a create request uses `sku` `"LW-019"`
- **THEN** the response is `409`

### Requirement: Listing, search and pagination
`GET /products` SHALL return a page of non-deleted products as `{ "items": [...], "total": n, "page": p, "limit": l }`. It SHALL accept `q` (case-insensitive substring match against `name` or `description`, with `%` and `_` treated literally), `category` (category id), `sort` (one of `name`, `price`, `stock`, `createdAt`; default `createdAt`), `order` (`asc` or `desc`; default `desc`), `page` (integer ≥ 1; default 1) and `limit` (integer 1–100; default 20). `total` SHALL count every product matching the filters, not only the returned page. An invalid query parameter SHALL be rejected with `400`.

#### Scenario: Substring search on name and description
- **WHEN** products named `Running Shoes` and `Wireless Mouse` exist, the second one described as `Ergonomic wireless mouse with USB receiver`, and `GET /products?q=MOUSE` is requested
- **THEN** `items` contains only `Wireless Mouse` and `total` is `1`

#### Scenario: Wildcard characters are literal
- **WHEN** products named `100% Cotton Tee` and `Cotton Socks` exist and `GET /products?q=100%25` is requested
- **THEN** `items` contains only `100% Cotton Tee`

#### Scenario: Category filter combined with search
- **WHEN** a `Footwear` category holds `Running Shoes` and `Hiking Boots`, an `Electronics` category holds `Running Watch`, and `GET /products?q=running&category={footwearId}` is requested
- **THEN** `items` contains only `Running Shoes`

#### Scenario: Pagination reports the full total
- **WHEN** 45 products exist and `GET /products?page=3&limit=20` is requested
- **THEN** `items` contains 5 products, `total` is `45`, `page` is `3` and `limit` is `20`

#### Scenario: Sorting by price
- **WHEN** products priced `18.75`, `89.99` and `0` exist and `GET /products?sort=price&order=asc` is requested
- **THEN** `items` are ordered `0`, `18.75`, `89.99`

#### Scenario: Invalid limit
- **WHEN** `GET /products?limit=500` is requested
- **THEN** the response is `400`

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
