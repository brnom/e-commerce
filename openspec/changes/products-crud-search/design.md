# Design

## Context

The scaffold (archived as `2026-09-20-scaffold-monorepo`) established: a hexagonal API where `domain/` and `application/` are framework-free and NestJS lives in `infra/`; ports as interfaces plus `Symbol` tokens bound by factory in Nest modules; `DomainValidationError` and `NotFoundError` mapped to `400`/`404` by a global filter; a `ZodValidationPipe`; an empty Prisma schema with the migrate-on-start path already exercised; a client-side Next.js app with TanStack Query and an `apiClient` that throws `ApiError(status, body)`; integration tests that boot `AppModule` with a mocked `PrismaService`. See proposal.md for motivation and `specs/product-catalog/spec.md` for the behavior contract.

Constraints: no comments in source (lint), layer rule (lint), `@/` imports, every DTO defined once in `packages/shared`.

## Goals / Non-Goals

**Goals:**

- Set the pattern one feature slice follows end to end: entity → port → use case → Prisma adapter → controller → shared schema → page. Later changes copy it.
- Search and pagination that stay correct and fast at a few hundred thousand rows without a search engine.
- Tests that exercise real SQL for the repository and real HTTP for the controller, plus fast unit tests for the rules.

**Non-Goals:**

- Restoring a soft-deleted product, or listing deleted products. The `deletedAt` column exists so future order lines keep resolving; an "archived products" screen is not in scope.
- Category management (rename, merge, delete). Categories are a by-product of products.
- Bulk operations, image upload, product variants, multi-currency.
- Authentication; the catalog is an open admin surface for now.

## Decisions

### D1. Data model: `Product` with a nullable `categoryId`, `Category` keyed by case-insensitive name

```
Category                    Product
--------                    -------
id         uuid v7          id           uuid v7
name       citext unique    sku          text unique (stored upper-case)
createdAt                   name         text
                            description  text null
                            price        decimal(12,2)
                            stock        int
                            weightKg     decimal(8,3) null
                            categoryId   uuid null -> Category
                            deletedAt    timestamptz null
                            createdAt / updatedAt
```

`Category.name` uses PostgreSQL's `citext` type (Prisma `@db.Citext`), so the unique constraint and equality comparisons are case-insensitive at the database level and "find or create" is a plain `upsert` on `name`. Two concurrent creates of the same new name are serialized by the unique constraint rather than by application locking. The migration creates the `citext` and `pg_trgm` extensions with `CREATE EXTENSION IF NOT EXISTS` before the tables.

Alternatives: **a `normalizedName` column with `@unique`** — no extension, but a second column to keep in sync and a rule that lives in code rather than in the schema. **Functional unique index on `lower(name)`** — not expressible in the Prisma schema, so `migrate dev` would flag it as drift.

UUID v7 (`@default(uuid(7))`) rather than cuid or serial: time-ordered, so `createdAt` sort and primary-key order agree, and ids are safe to expose in URLs.

### D2. SKU: normalized on the way in, unique across deleted products too

The `sku` is trimmed and upper-cased in the shared zod schema, so the API, the web form and (later) the CSV importer normalize identically before the value reaches the domain. Uniqueness is a plain unique index over the whole table; a soft-deleted product keeps its SKU. The alternative — a partial unique index `WHERE "deletedAt" IS NULL` — would let a new product silently take a deleted product's SKU and later confuse order history and CSV upserts that match on SKU. Restoring a deleted product is out of scope, so the reserved SKU is surfaced as a `409` whose message says the SKU is taken.

Prisma's `P2002` unique-violation error is translated in the repository into a `ConflictError(field, value)`; a new `ConflictError` joins `domain/shared/domain-error.ts` and the exception filter maps it to `409 { message, field, value }`. Pre-checking with a `findUnique` would leave a race; catching the constraint violation is the correct check.

### D3. Money and weight: `Decimal` in the database, `number` over the wire

`price` and `weightKg` are `Decimal` columns so arithmetic done in SQL (order totals in the purchase change) is exact. In JSON they are plain numbers: forms bind naturally, and a price with two fraction digits is represented exactly enough by a double for display and comparison. The zod schema enforces the fraction-digit limit (`Math.round(v * 100) / 100 === v`); the repository converts with `Decimal.toNumber()` on read and passes numbers on write. Totals are never computed by summing JavaScript numbers; that rule is enforced when the purchase change arrives.

Alternative: **strings in JSON** — exact, but every form field and every table cell needs parsing and formatting, and the shared schema would carry two representations.

### D4. Feature layout in the API

```
apps/api/src/
  domain/product/
    product.ts                   Product type, Category type, normalizeSku()
  application/ports/
    product-repository.ts        ProductRepository + PRODUCT_REPOSITORY
    category-repository.ts       CategoryRepository + CATEGORY_REPOSITORY
  application/products/
    create-product.ts            one class per use case, constructor takes ports
    get-product.ts
    update-product.ts
    delete-product.ts
    list-products.ts
    list-categories.ts
  infra/persistence/prisma/
    prisma-product.repository.ts
    prisma-category.repository.ts
  infra/http/products/
    products.controller.ts       validates with ZodValidationPipe, delegates to use cases
    products.module.ts           binds both ports and provides use cases via useFactory
  infra/http/categories/
    categories.controller.ts
```

Use cases are plain classes without Nest decorators, provided as `{ provide: CreateProduct, useFactory: (products, categories) => new CreateProduct(products, categories), inject: [PRODUCT_REPOSITORY, CATEGORY_REPOSITORY] }`. Unit tests construct them with in-memory fakes of the two ports. The category "find or create" belongs to the `CategoryRepository` port (`findOrCreate(name)`), because atomicity comes from the unique constraint, not from the use case.

The `ProductRepository` port exposes `create`, `findById`, `update`, `softDelete` and `search(query)` where `query` is the parsed list DTO; every read method excludes `deletedAt IS NOT NULL` rows so callers cannot forget the filter. The purchase change will add stock reservation to this port.

### D5. Search: `ILIKE` through Prisma `contains`, backed by a trigram GIN index

`q` becomes `OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }]`. Prisma escapes `%` and `_` in `contains`, which satisfies the "wildcards are literal" scenario without hand-built patterns. A GIN index with `gin_trgm_ops` on `name` and `description` (`@@index([...], type: Gin)`) lets PostgreSQL serve `ILIKE '%term%'` from the index instead of a sequential scan. `total` comes from a second `count` with the same `where`, issued in the same `$transaction` as the page query so the two agree.

Alternatives: **`tsvector` full-text search** — better ranking and stemming, but requires a generated column, a language choice and query-syntax handling; the catalog has short names and one-line descriptions, where substring match is what users expect. **A search engine (Meilisearch, OpenSearch)** — a fourth container and a sync pipeline for a problem PostgreSQL solves at this scale.

### D6. Soft delete as a repository concern

`deletedAt` is set by `softDelete(id)`, which is an `updateMany({ where: { id, deletedAt: null } })` returning the affected count; zero means "not found or already deleted" and the use case raises `NotFoundError`, which gives both scenarios a `404` without a preliminary read. `findById` and `search` always filter `deletedAt: null`. The filter is inside the adapter so the invariant holds no matter which use case calls it.

Alternative: **Prisma client extension that rewrites every query** — hides the filter from readers and complicates the (rare) future query that wants deleted rows.

### D7. Web: URL as the source of truth for list state, forms driven by the shared schema

- `/products` reads `q`, `category`, `sort`, `order`, `page` from the URL search params and passes them straight to `GET /products`; typing in the search box updates the URL (debounced, `router.replace`). The query key is `["products", params]`, so back/forward and shared links reproduce the same list.
- `/products/new` and `/products/[id]/edit` share one `ProductForm` component using `react-hook-form` with `zodResolver(createProductSchema)`; numeric inputs use `valueAsNumber`. On `ApiError`, a `400` body's `issues[]` and a `409` body's `field` are written into the form with `setError`, so server-side messages appear next to the right field.
- Delete is an inline two-step control (click → "Confirm / Cancel") rather than `window.confirm`, so it is testable and does not block the page.
- `GET /categories` feeds both the filter `<select>` and a `<datalist>` on the category input, so users see existing names but can still type a new one.
- Rendering uses React's default text escaping; no `dangerouslySetInnerHTML` anywhere in the app, enforced with a `no-restricted-syntax` selector on the `dangerouslySetInnerHTML` JSX attribute in the web lint config.

Alternatives: **component state for filters** — simpler, but loses shareable URLs and resets on refresh. **Server Components for the list** — rejected in the scaffold (single API URL).

### D8. Tests: real PostgreSQL for adapters and HTTP, fakes for use cases

The `integration` Vitest project runs against a real database at `TEST_DATABASE_URL` (default `postgresql://app:app@localhost:5432/ecommerce_test`, alongside the dev database on the compose `db` service). A Vitest global setup creates the database if missing and runs `prisma migrate deploy` against it; each test file truncates the tables it touches. The health test keeps its mocked `PrismaService` since it exercises the failure path. CI gains a `postgres:16-alpine` service on the quality-gate job. The `unit` project needs no database.

Mocking Prisma for the repository would test the mock: the behaviors that matter here — wildcard escaping, case-insensitive category reuse, soft-delete filtering, `total` versus page size, unique-violation translation — are all SQL behaviors.

Web tests use `@testing-library/react` with `fetch` stubbed per test (the pattern from `api-client.test.ts`), covering: form blocks invalid submission, server `409` lands on the SKU field, delete confirmation, and markup rendered as text.

## Risks / Trade-offs

- [`citext` and `pg_trgm` must exist before the tables] → The migration's first statements are `CREATE EXTENSION IF NOT EXISTS`; both ship with the `postgres:16-alpine` image and need no superuser beyond the compose default user. The Prisma shadow database applies the same migration, so `migrate dev` sees no drift.
- [Prisma `contains` escaping is an implementation detail of Prisma] → The "wildcard characters are literal" scenario is an integration test; if a Prisma upgrade changes escaping, the test fails.
- [`Decimal → number` loses precision above 2^53 / 100] → Prices in this catalog are far below that; the schema caps `price` at `9_999_999_999.99` (the column's `decimal(12,2)`), which a double represents exactly at two fraction digits.
- [Integration tests need a running database] → `pnpm test` documents `docker compose up db -d` as a prerequisite; `pnpm --filter api vitest run --project unit` stays database-free, and CI provides the service.
- [Multicolumn GIN index is larger than two single-column indexes] → Acceptable for a catalog; revisit if write throughput ever matters more than search latency.
- [Debounced URL updates on every keystroke add history noise] → `router.replace`, not `push`, so the history stack has one entry per page.

## Migration Plan

One migration, `product_catalog`: extensions, `Category`, `Product`, unique index on `sku`, GIN trigram index, foreign key `categoryId → Category.id` with `ON DELETE SET NULL`. Applied by the existing migrate-on-start entrypoint; nothing to backfill. Rollback is a down migration dropping both tables (extensions can stay).

## Open Questions

- Whether the list should default to `limit=20` or `limit=50` for the admin UI. Adjustable through the query parameter; the default can change without touching the spec's bounds.
