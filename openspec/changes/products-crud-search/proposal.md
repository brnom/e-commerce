# Proposal

## Why

The platform has a running stack but no domain: there is nothing to sell, list or search. The product catalog is the foundation every other feature depends on — CSV import writes products, purchasing reads and decrements them — so it has to exist first, with its validation rules, its search behavior and its UI settled.

## What Changes

- Add the `Product` and `Category` models to the database, with the first real migration. A product has a unique SKU, a name, an optional description, a price, a stock quantity, an optional weight and an optional category. Categories are created on the fly from the name typed by the user rather than chosen from a fixed list.
- Add a REST API for products: create, read one, update, delete (soft, so a deleted product stops appearing but its identity survives for future order history) and a list endpoint that combines full-text-style search (`q` matched against name and description), category filter, sorting and pagination.
- Add a read-only categories endpoint so the UI can offer the existing categories as filter options and as suggestions in the product form.
- Define every product DTO as a zod schema in `packages/shared`, used by the API to validate requests and by the web app to validate forms before submitting.
- Add the product pages to the web app: a paginated list with a search box and category filter, a create form, an edit form and a delete action with confirmation. Search is not a separate screen; it is the list with filters applied.
- Extend the API's domain and application layers with the first use cases and repository port, establishing the pattern later changes follow.

## Capabilities

### New Capabilities

- `product-catalog`: the products a store sells and how they are created, edited, removed, listed and searched — including the validation rules a product must satisfy and how categories come into existence.

### Modified Capabilities

_None. The `deployment` capability is unchanged: this change adds a migration, which the existing "migrations applied before serving" requirement already covers._

## Impact

- **Database:** new migration creating `Category` and `Product` tables, a unique index on SKU, and a trigram index on name and description to keep search fast as the catalog grows. Enables the `pg_trgm` extension.
- **API (`apps/api`):** new `domain/product`, `application/products` (ports and use cases), `infra/persistence/prisma` product and category repositories, `infra/http/products` and `infra/http/categories` controllers. `app.module.ts` wires the new module.
- **Shared (`packages/shared`):** new `product` schemas (`createProductSchema`, `updateProductSchema`, `listProductsQuerySchema`) and inferred types; the package gains its first domain module.
- **Web (`apps/web`):** new routes `/products`, `/products/new`, `/products/[id]/edit`; new dependencies `react-hook-form` and `@hookform/resolvers`. The home page links to the catalog.
- **Later changes:** `csv-import` reuses the product validation schema and the category find-or-create rule; `purchase` reads products and decrements stock through the repository port introduced here.
