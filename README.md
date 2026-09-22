# E-commerce

A small e-commerce platform: a product catalog with search, bulk import from CSV, and a purchase flow with a simulated payment provider. It is built as a pnpm monorepo with a NestJS API, a Next.js web app and PostgreSQL, and runs end to end with one `docker compose up`.

This repository was built for a technical assessment. The functional brief (product CRUD, CSV import, search, purchase with a fake payment, a UI for all of it, Docker, local DB) is treated here as the product requirements of a real system, and the reasoning behind each decision is recorded in [Decisions](#decisions) and in the `openspec/` directory.

## Prerequisites

- Docker Desktop (or Docker Engine 24+ with the Compose plugin) to run the stack.
- For local development additionally: Node 24 and pnpm 10 (`corepack enable && corepack prepare pnpm@10.32.1 --activate`).

## Run with Docker

```bash
docker compose up --build
```

Then open:

- Web app: http://localhost:3000
- API health: http://localhost:3001/health

The API applies pending database migrations before it starts listening; the database keeps its data in the `pgdata` volume across restarts. Use `docker compose down -v` to start from an empty database.

## Run for development

```bash
pnpm install
docker compose up db -d
cp .env.example .env
pnpm dev
```

`pnpm dev` starts the API on port 3001 with hot reload and the web app on port 3000. The Prisma client is generated automatically as part of the Turborepo task graph. The API watcher does not reload `packages/shared`; after editing a shared schema, restart `pnpm dev`.

The API's integration tests run against a real PostgreSQL database, `ecommerce_test` on the same `db` container (`TEST_DATABASE_URL`). The test run creates that database if it is missing and applies the migrations, so `docker compose up db -d` is the only prerequisite for `pnpm test`. Unit tests need no database: `pnpm --filter api exec vitest run --project unit`.

## Quality gate

```bash
pnpm check
```

Runs, for every workspace: ESLint, `tsc --noEmit`, Vitest, and a Prettier check. The same command runs in CI on every push and pull request (`.github/workflows/ci.yml`, with a PostgreSQL service for the integration tests), together with a build of both Docker images.

Two lint rules are worth knowing about:

- **No comments in source files.** Intent is expected to live in names, types, tests and this document. The rule is enforced with `eslint-plugin-no-comments` on everything under `apps/*/src`, `apps/*/test` and `packages/*/src`.
- **`@/` imports in the API.** `@/application/ports/config` instead of `../../application/ports/config`. The Nest CLI compiles with SWC so the alias is rewritten in the emitted JavaScript; `tsc --noEmit` still type-checks every build.
- **Layer boundaries in the API.** `domain/` may not import `application/` or `infra/`; `application/` may not import `infra/` or any framework. Enforced with `no-restricted-imports`, so a violation fails `pnpm lint`.
- **No `dangerouslySetInnerHTML` in the web app.** Product data (names, descriptions) is user-supplied and is always rendered as text; the attribute is rejected by `no-restricted-syntax`.
- **Copied UI components are linted like everything else.** shadcn/ui components live in `apps/web/src/components/ui` and go through the same rules (including the no-comments rule) after generation.

## Environment variables

Defaults work for local development and for Compose. A committed `.env.example` documents every variable.

| Variable              | Used by      | Default                                              | Purpose                                            |
| --------------------- | ------------ | ---------------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`        | api          | `postgresql://app:app@localhost:5432/ecommerce`      | PostgreSQL connection string. Required.            |
| `TEST_DATABASE_URL`   | api (tests)  | `postgresql://app:app@localhost:5432/ecommerce_test` | Database the integration tests create and migrate. |
| `API_PORT`            | api          | `3001`                                               | HTTP port the API listens on.                      |
| `WEB_ORIGIN`          | api          | `http://localhost:3000`                              | Origin allowed by CORS.                            |
| `NEXT_PUBLIC_API_URL` | web          | `http://localhost:3001`                              | API base URL as seen from the browser. Build-time. |
| `POSTGRES_USER`       | compose (db) | `app`                                                | Database user.                                     |
| `POSTGRES_PASSWORD`   | compose (db) | `app`                                                | Database password.                                 |
| `POSTGRES_DB`         | compose (db) | `ecommerce`                                          | Database name.                                     |

The API validates its environment at startup and exits with a non-zero status naming any missing or malformed variable.

## Repository layout

```
apps/
  api/                 NestJS REST API
    src/domain/        entities, value objects, domain errors (no framework imports)
    src/application/   ports (interfaces + injection tokens) and use cases, with in-memory fakes for tests
    src/infra/         NestJS modules, HTTP controllers/pipes/filters, Prisma adapters, fake payment gateway, env config
    src/main.ts        bootstrap; with app.module.ts, the composition root
    prisma/            schema and migrations
    test/              integration tests that boot the Nest application
  web/                 Next.js App Router application, client-side rendered
    src/app/           routes (/, /products, /products/new, /products/[id], /products/[id]/edit, /imports, /imports/[id], /cart, /checkout, /orders, /orders/[id]), globals.css tokens
    src/components/ui/ shadcn/ui components (generated, then owned)
    src/components/layout/ header, footer, page header
    src/components/products/ table, filters, form, detail page, delete dialog, states
    src/components/imports/  upload card, import history, per-row report
    src/components/cart/     add-to-cart button, header cart link, cart page, checkout page
    src/components/orders/   order history, order page, status badge
    src/lib/           API client, typed product/import/order endpoints, URL state for the list, browser cart store, fonts
    src/fonts/         vendored Archivo (display); Geist comes from the `geist` package
packages/
  shared/              zod schemas and TypeScript types used by both apps
data/                  sample product CSV used by the import's integration test
openspec/              change proposals, designs, specs and task lists (spec-driven workflow)
docker-compose.yml     db + api + web
```

## Decisions

Each change in this repository was planned before it was built: `openspec/changes/<name>/` holds a proposal (why), a design (how, with alternatives considered), a spec delta (what the system must do, as testable scenarios) and a task list. Archived changes live in `openspec/changes/archive/`, and the accumulated behavior contract lives in `openspec/specs/`.

The architectural choices, with the alternatives that were weighed, are in each change's `design.md`: [`scaffold-monorepo`](openspec/changes/archive/2026-09-20-scaffold-monorepo/design.md), [`products-crud-search`](openspec/changes/archive/2026-09-21-products-crud-search/design.md), [`web-design-system`](openspec/changes/archive/2026-09-21-web-design-system/design.md), [`csv-import`](openspec/changes/archive/2026-09-21-csv-import/design.md) and [`purchase`](openspec/changes/archive/2026-09-22-purchase/design.md). In short:

**Foundation**

- **Separate API and web app, API owns the database.** The web app is client-side rendered and talks to the API over HTTP with a single public base URL. Rejected: Next.js full-stack (couples UI to domain), Server Components fetching from the API (two base URLs, caching semantics that buy nothing for an admin-style UI).
- **PostgreSQL + Prisma 7.** Transactional guarantees for stock reservation and text-search extensions later; migrations that run identically locally, in CI and in the container. Rejected: TypeORM (entities drift), Drizzle (younger Nest story), SQLite (no concurrency semantics).
- **Hexagonal API layout with NestJS confined to `infra/`.** Business rules are plain TypeScript, constructed directly in unit tests; Nest modules bind ports to adapters. Rejected: Nest's conventional feature-module layout (rules end up decorated and coupled to Nest and Prisma).
- **One zod schema per DTO, shared by API and web.** Rejected: class-validator (cannot be consumed by the browser), OpenAPI codegen (a build step for one team).
- **Migrations in the API container entrypoint.** A fresh `up` on an empty volume needs no extra step, and a failing migration stops the API from serving. Rejected: a separate one-shot migrate service.

**Product catalog**

- **Categories are a table created on demand, keyed by a case-insensitive name.** The category typed on a product is matched against existing ones (`citext` unique column, so `Electronics` and `electronics` are one row) or created. Rejected: a fixed enum (the next data set with a new category would need a code change) and free text on the product (no clean filter).
- **Soft delete with a reserved SKU.** Deleting a product sets `deletedAt`; it disappears from every read and from search, but its row survives so future order lines keep resolving. The SKU stays unique across deleted rows, so a new product cannot silently take an old identity; the API answers `409`. Rejected: hard delete (breaks order history), partial unique index (lets a SKU be reused).
- **Validation rules live in one zod schema, shared by API and form.** `sku` trimmed and upper-cased, `name` required, `price` a decimal with at most two fraction digits and no currency symbol, `stock` a non-negative integer, `weightKg` optional. The form rejects invalid input before a request is sent; the API rejects it again and reports every failing field at once.
- **Money as `Decimal` in the database, `number` in JSON.** Exact arithmetic where it will matter (order totals), plain numbers where forms and tables bind them. Rejected: strings in JSON (parsing in every field and cell).
- **Search is `ILIKE` with a trigram index, not full-text search.** `q` is a case-insensitive substring match on name and description, with `%` and `_` treated literally, served from a `pg_trgm` GIN index. Rejected: `tsvector` (stemming and ranking buy little for short product names and add query-syntax handling) and a search engine (a fourth container for a problem PostgreSQL solves at this scale).
- **Integration tests hit a real PostgreSQL.** Repository and HTTP tests run against `ecommerce_test`; the behaviors that matter — wildcard escaping, case-insensitive category reuse, soft-delete filtering, unique-violation translation — are SQL behaviors, and mocking Prisma would test the mock. Use cases are unit-tested with in-memory fakes.
- **The list page keeps its state in the URL.** Search, category, sort and page are query parameters, so a filtered list can be refreshed, shared and navigated with back/forward.

**Web design system**

- **Tailwind CSS + shadcn/ui, components copied into the repository.** shadcn is a generator, not a dependency: each component is a file under `src/components/ui` that we own and lint. Rejected: MUI (its Material idiom must be undone through theming to reach a black-and-white look), Radix Themes (layout primitives fight Tailwind), hand-written CSS (accessible dialog and select would have to be written and tested by hand).
- **Black, white and one gray; typography carries the design.** There are no images anywhere. Headings use Archivo Expanded (uppercase, tight tracking), interface text uses Geist Sans, and every figure (SKU, price, stock, weight, counts) uses Geist Mono so columns align. Fonts are vendored and loaded with `next/font/local`, so `docker build` never calls Google Fonts.
- **Every data view has a loading, empty, error and not-found state**, and destructive actions confirm in a Radix dialog (focus trap, `Escape`, focus return) rather than a browser `confirm()`.

**CSV import**

- **Partial import with a per-row report.** Every row is validated with the product schema; valid rows are written and each invalid row is reported with its line number, field and message, so a supplier file with a few bad lines still loads and the report says exactly what to fix. Rejected: all-or-nothing (one `$29.99` blocks 90 good rows) and silent skipping (nobody learns what was dropped).
- **Rows match products by SKU; a known SKU updates, an unknown one creates.** Re-importing the same file never duplicates a product. A SKU that belongs to a deleted product brings it back, since the file says the store wants it. Inside one file the first occurrence of a SKU wins and later ones are rejected pointing at the first line; last-wins would let a stray copy at the bottom overwrite a deliberate row.
- **Columns absent from the file leave stored values untouched; blank cells clear them.** A price list that only carries `sku,price,stock` updates prices without wiping descriptions.
- **One transaction per file, owned by a single port method.** The use case parses and validates in memory and hands a plan (writes plus rejected rows) to `ImportJobRepository.commit`, which upserts the products, resolves categories and records the job in one interactive transaction. The history never claims products that are not there. Rejected: a generic unit-of-work port threaded through every repository, for one caller.
- **Every import is recorded** (`ImportJob` with counters and the row report as JSON) so a past report can be reopened from `/imports`.

**Purchase**

- **Reserve, charge, settle — in two transactions.** `POST /orders` first reserves stock for every line in one transaction (a conditional `UPDATE … WHERE stock >= quantity` per product, processed in a fixed order so concurrent orders cannot deadlock), then calls the payment provider outside any transaction, then settles: `paid` with the provider's reference, or `payment_failed` with the reason and every line's stock put back. Holding the transaction open across the provider call would keep row locks for the length of an external request. The conditional update is what makes overselling impossible: the second of two concurrent orders for the last unit finds `stock >= 1` false once the first commits. Rejected: `SELECT … FOR UPDATE` (same guarantee, raw SQL and a second round trip), an optimistic version column (a retry loop for a problem the row lock already solves).
- **One short item rejects the whole order.** The response is `409` listing every problem item with the requested and available quantities and a reason (`insufficient_stock` or `unavailable` for a deleted or unknown product); nothing is written. The checkout page applies that list to the cart — removing what is gone, lowering what is short — and says so before the user tries again. Rejected: partial fulfilment (the customer did not ask for half an order).
- **A declined payment is an outcome, not an error.** The order was created and is visible in the history, so `POST /orders` answers `201` whether the card was approved or declined; `status` carries the result. Rejected: `402 Payment Required` (the client would have to fish a successful write out of an error body).
- **The payment provider is a port with a deterministic fake adapter.** `4242 4242 4242 4242` (or any other valid number) approves, `4000 0000 0000 0002` is declined, `4000 0000 0000 9995` has insufficient funds — the widely known test numbers, which pass the Luhn check the form and API enforce. Rejected: random outcomes (not reproducible in tests or demos) and always-approve (the stock-release path would be untested code).
- **No card data is stored.** The card number, expiry and security code go to the gateway and nowhere else; the order keeps the last four digits. A crash between reservation and settlement leaves an order `pending` with its stock held; that state is visible in `/orders` and, with a real provider, would get a sweeper.
- **Order lines are a snapshot.** Each line records the SKU, name and unit price at purchase time, and totals are computed in integer cents, so a later price change or deletion never rewrites an order and `3 × 19.99` is `59.97`. The line keeps a foreign key to the product — the reason products are soft-deleted rather than removed.
- **The checkout is one click by default.** The provider is a fake with three known outcomes, so the honest UI for it is a selector listing those outcomes with the approving card pre-selected and a sample customer filled in; picking "Enter another card" shows the plain card fields, and the form values stay the single source of truth, so validation and the request are the same either way. Rejected: empty fields that everyone fills by copying a number from this file, and a hidden "demo mode" toggle for a provider that is always a demo.
- **The cart lives in the browser.** It is a `localStorage`-backed store read through `useSyncExternalStore`, holding a display snapshot per line; the order is priced by the API from the catalog, never from the cart. Rejected: a server-side cart (a session or customer concept the product does not have) and holding stock while items sit in a cart.

## CSV import

Upload a file at `/imports`, or `curl -F file=@data/e-commerce_input.csv http://localhost:3001/imports`. The response, and `GET /imports/{id}` later, is the job with one entry per data row.

| Column        | Required | Rule                                                                  |
| ------------- | -------- | --------------------------------------------------------------------- |
| `name`        | yes      | 1–200 characters after trimming                                       |
| `sku`         | yes      | 1–64 characters, stored upper-cased, matched case-insensitively       |
| `price`       | yes      | plain decimal, `.` separator, at most two fraction digits, no symbols |
| `stock`       | yes      | non-negative integer                                                  |
| `description` | no       | at most 2000 characters                                               |
| `category`    | no       | created on demand, matched case-insensitively                         |
| `weight_kg`   | no       | plain decimal, at most three fraction digits                          |

Header names are matched case-insensitively; unknown columns are ignored. UTF-8 with an optional BOM, comma-separated, quoted fields allowed. Limits: 2 MB and 5,000 data rows per file. Each row ends as `created`, `updated`, `skipped` (entirely blank line) or `failed` (with issues); rows are numbered by their line in the file, the header being line 1.

The sample file `data/e-commerce_input.csv` (downloaded on **2026-09-20**) has 97 data rows and imports as **87 created, 2 skipped, 8 failed**: `$29.99` and `free` as prices, `-5` stock, an empty and a whitespace-only name, and three later duplicates of `RS-001` / `BS-021`. Importing it a second time gives 87 updated. That outcome is asserted by `apps/api/test/imports.integration.test.ts`.

## Purchase

Add products to the cart from the products page or a product's page, review the cart at `/cart`, and pay at `/checkout` with a name, an email and a card. The checkout opens ready to submit: the customer fields hold a sample customer and the card selector has the approving test card chosen, so one click places a paid order. The selector also offers the two declining cards and an "Enter another card" option that reveals the card fields. Orders appear at `/orders` and each order has a page with its lines, total, status and card's last four digits. The payment provider is simulated; these are its test cards (any future expiry `MM/YY` and any 3–4 digit security code work when typing one):

| Card number           | Outcome                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `4242 4242 4242 4242` | Approved (as is any other number passing the Luhn check)         |
| `4000 0000 0000 0002` | Declined — "Your card was declined"; stock is put back           |
| `4000 0000 0000 9995` | Declined — "Your card has insufficient funds"; stock is put back |

Endpoints: `POST /orders` (`{ items: [{ productId, quantity }], customer: { name, email }, card: { cardholderName, cardNumber, expiry, cvc } }`; `201` with the order in status `paid` or `payment_failed`; `400` with per-field issues; `409` with `items: [{ productId, requested, available, reason }]` when stock is short or a product is unavailable), `GET /orders` (summaries, newest first) and `GET /orders/{id}`. Limits: 50 lines per order, 100 units per line.

## Status

| Change                 | State    | Delivers                                                                                |
| ---------------------- | -------- | --------------------------------------------------------------------------------------- |
| `scaffold-monorepo`    | archived | monorepo, API + web skeletons, Postgres, Docker, CI, this file                          |
| `products-crud-search` | archived | `Product`/`Category` model, CRUD API, list + search + form UI                           |
| `web-design-system`    | archived | Tailwind + shadcn/ui, black-and-white typographic UI, detail page                       |
| `csv-import`           | archived | CSV upload, per-row validation report, upsert by SKU                                    |
| `purchase`             | archived | cart, checkout, orders API with stock reservation, fake payment                         |
| `purchase-ux`          | applied  | one-click checkout with test-card selector, steppers, confirmed removal, pressed states |
