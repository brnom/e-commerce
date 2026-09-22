# <img src="apps/web/src/app/icon.svg" alt="" width="24" height="24"> E-commerce

A small e-commerce platform: a product catalog with search, bulk import from CSV, and a purchase flow with a simulated payment provider. It is built as a monorepo with a Python API (FastAPI), a Next.js web app and PostgreSQL, and runs end to end with one `docker compose up`.

This repository was built for a technical assessment. The functional brief (product CRUD, CSV import, search, purchase with a fake payment, a UI for all of it, Docker, local DB) is treated here as the product requirements of a real system, and the reasoning behind each decision is recorded in [Decisions](#decisions) and in the `openspec/` directory.

## Demo

Both recordings are of the running stack: the Next.js app on `localhost:3005` talking to the API on `localhost:5001`. They were recorded before the API moved from NestJS to Python; the HTTP contract, and so every screen, is the same.

**Catalog — search, filter and create a product.** A search with no match shows the empty state, the category select filters the list, a row opens the product page, and the form creates the product that was missing.

![Browsing, filtering and creating a product](docs/demo-catalog.gif)

**CSV import and purchase.** `data/e-commerce_input.csv` is imported with its per-row report (87 updated, 2 skipped, 8 failed, each failure naming the field and the reason), then a product goes into the cart and the one-click checkout places a paid order with the simulated provider.

![Importing a CSV and placing an order](docs/demo-import-purchase.gif)

## Prerequisites

- Docker Desktop (or Docker Engine 24+ with the Compose plugin) to run the stack.
- For local development additionally: Node 26 and pnpm 10 (`npm install --global pnpm@10.32.1`) for the web app and the shared package, and Python 3.14 with [uv](https://docs.astral.sh/uv/) for the API (`brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`; uv fetches Python 3.14 itself if it is missing).

## Run with Docker

```bash
docker compose up --build
```

Then open:

- Web app: http://localhost:3005
- API health: http://localhost:5001/health

The API applies pending database migrations before it starts listening; the database keeps its data in the `pgdata` volume across restarts. Use `docker compose down -v` to start from an empty database.

**Upgrading from the NestJS API.** A `pgdata` volume created before the move to Python was migrated by Prisma, and Alembic will not adopt it: the API exits on its first migration. Run `docker compose down -v` once; the schema itself is unchanged.

**The catalog starts empty.** Load the 97-row sample file, downloaded on **2026-09-17**, to get a populated store:

```bash
curl -F file=@data/e-commerce_input.csv http://localhost:5001/imports
```

The same file can be uploaded at http://localhost:3005/imports, which shows the per-row report described in [CSV import](#csv-import).

## Run for development

```bash
pnpm install
docker compose up db -d
cp .env.example .env
pnpm dev
```

`pnpm dev` starts the API on port 5001 with hot reload (`uv run python -m ecommerce_api --reload`, installing the Python dependencies on first run) and the web app on port 3005. Apply the migrations to the development database once with `pnpm db:migrate` (it reads `.env`), and again after pulling a new one.

The API's integration tests run against a real PostgreSQL database, `ecommerce_test` on the same `db` container (`TEST_DATABASE_URL`). Each test run drops and recreates that database and applies the migrations, so `docker compose up db -d` is the only prerequisite for `pnpm test`. Unit tests need no database: `cd apps/api && uv run pytest tests/unit`.

## Quality gate

```bash
pnpm check
```

Runs, for every workspace: ESLint, `tsc --noEmit` and Vitest for the web app and the shared package; Ruff (lint and format check), mypy in strict mode, import-linter and pytest for the API; and a Prettier check. The API's `package.json` only wraps those `uv run` commands, so Turborepo runs both languages the same way. The same command runs in CI on every push and pull request (`.github/workflows/ci.yml`, with a PostgreSQL service for the integration tests), together with a build of both Docker images.

Some lint rules are worth knowing about:

- **No comments in source files.** Intent is expected to live in names, types, tests and this document. In TypeScript the rule is `eslint-plugin-no-comments` on `apps/web/src` and `packages/*/src`; in the API, `apps/api/scripts/check_sources.py` rejects every `#` comment and docstring under `src/`, `tests/`, `migrations/` and `scripts/`, printing file and line.
- **Absolute imports in the API.** `from ecommerce_api.application.ports.config import Config`, never a relative import (Ruff `TID252`).
- **Layer boundaries in the API.** `domain/` may not import `application/` or `infra/`; `application/` may not import `infra/`, FastAPI, Starlette, SQLAlchemy, psycopg or Alembic; `domain/` may not import Pydantic either. Enforced with import-linter contracts in `apps/api/pyproject.toml`, so a violation fails `pnpm lint`.
- **No `dangerouslySetInnerHTML` in the web app.** Product data (names, descriptions) is user-supplied and is always rendered as text; the attribute is rejected by `no-restricted-syntax`.
- **Copied UI components are linted like everything else.** shadcn/ui components live in `apps/web/src/components/ui` and go through the same rules (including the no-comments rule) after generation.

## Environment variables

Defaults work for local development and for Compose.

| Variable              | Used by      | Purpose                                              |
| --------------------- | ------------ | ---------------------------------------------------- |
| `DATABASE_URL`        | api          | PostgreSQL connection string. Required.              |
| `TEST_DATABASE_URL`   | api (tests)  | Database the integration tests recreate and migrate. |
| `API_PORT`            | api, compose | HTTP port the API listens on.                        |
| `WEB_PORT`            | web, compose | HTTP port the web app listens on.                    |
| `WEB_ORIGIN`          | api          | Origin allowed by CORS.                              |
| `NEXT_PUBLIC_API_URL` | web          | API base URL as seen from the browser. Build-time.   |
| `POSTGRES_USER`       | compose (db) | Database user.                                       |
| `POSTGRES_PASSWORD`   | compose (db) | Database password.                                   |
| `POSTGRES_DB`         | compose (db) | Database name.                                       |

The defaults, as committed in `.env.example`:

```bash
POSTGRES_USER=app
POSTGRES_PASSWORD=app
POSTGRES_DB=ecommerce

DATABASE_URL=postgresql://app:app@localhost:5432/ecommerce
TEST_DATABASE_URL=postgresql://app:app@localhost:5432/ecommerce_test
API_PORT=5001
WEB_PORT=3005
WEB_ORIGIN=http://localhost:3005

NEXT_PUBLIC_API_URL=http://localhost:5001
```

The API validates its environment at startup and exits with a non-zero status naming any missing or malformed variable.

Both ports come from the environment, so moving the stack is an edit to `.env` and nothing else: `pnpm dev` runs through `dotenv -e .env`, the web dev server takes `WEB_PORT` and the API takes `API_PORT`, and Compose reads the same file for its published ports. Changing a port means changing the URL that names it too — `WEB_ORIGIN` is the origin the API allows through CORS, and `NEXT_PUBLIC_API_URL` is baked into the web bundle at build time.

## Repository layout

```
apps/
  api/                  Python REST API (FastAPI), managed with uv
    src/ecommerce_api/
      domain/           entities, value objects, domain errors (plain Python)
      application/      ports (Protocols), use cases, Pydantic input models
      infra/            FastAPI app, routers, error handlers, SQLAlchemy Core repositories, fake payment gateway, env config
      __main__.py       entry point: reads the environment and runs uvicorn
    migrations/         Alembic revisions, each running one SQL file from migrations/sql/
    scripts/            check_sources.py, the no-comments rule for Python
    tests/              pytest: unit/ with in-memory fakes, integration/ against PostgreSQL
  web/                  Next.js App Router application, client-side rendered
    src/app/            routes: /, /products, /imports, /cart, /checkout, /orders and their detail pages; globals.css tokens
    src/components/
      ui/               shadcn/ui components (generated, then owned)
      layout/           header, footer, page header
      products/         table, filters, form, detail page, delete dialog, states
      imports/          upload card, import history, per-row report
      cart/             add-to-cart button, header cart link, cart page, checkout page
      orders/           order history, order page, status badge
    src/lib/            API client, typed product/import/order endpoints, URL state for the list, browser cart store, fonts
    src/fonts/          vendored Archivo (display); Geist comes from the `geist` package
packages/
  shared/               zod schemas and TypeScript types used by the web app; validation-cases/ run by both test suites
data/                   sample product CSV used by the import's integration test
docs/                   demo recordings used by this file
openspec/               change proposals, designs, specs and task lists (spec-driven workflow)
docker-compose.yml      db + api + web
```

## API

Every endpoint is JSON over HTTP, unauthenticated, on `http://localhost:5001` by default. Validation failures answer `400` with one entry per failing field; an unknown id answers `404`; a conflict answers `409`.

The whole contract is browsable and callable at [`/docs`](http://localhost:5001/docs) — Swagger UI generated by FastAPI from the routes and the Pydantic models they validate with, with the raw OpenAPI document at `/docs/json`.

| Method   | Path            | Purpose                                                                                                                                                                                                                                                                                                                     |
| -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/health`       | Liveness plus a database check, used by the Compose healthcheck.                                                                                                                                                                                                                                                            |
| `GET`    | `/products`     | Paginated list, answering `{ items, total, page, limit }`. Query: `q` (case-insensitive substring of name or description), `category` (a category id), `sort` (`name`, `price`, `stock`, `createdAt`; default `createdAt`), `order` (`asc`, `desc`; default `desc`), `page` (default 1), `limit` (default 20, at most 100). |
| `POST`   | `/products`     | Creates a product. Body: `name`, `sku`, `price`, `stock`, optional `description`, `category`, `weightKg`. `409` when the SKU is taken, including by a deleted product.                                                                                                                                                      |
| `GET`    | `/products/:id` | One product. `404` once it is deleted.                                                                                                                                                                                                                                                                                      |
| `PATCH`  | `/products/:id` | Partial update, same field rules as the create.                                                                                                                                                                                                                                                                             |
| `DELETE` | `/products/:id` | Soft delete; answers `204`. The row survives so order lines keep resolving.                                                                                                                                                                                                                                                 |
| `GET`    | `/categories`   | Every category, ordered by name. Categories are created on demand by products and imports.                                                                                                                                                                                                                                  |
| `POST`   | `/imports`      | `multipart/form-data` with a `file` field. See [CSV import](#csv-import) for the contract and the limits.                                                                                                                                                                                                                   |
| `GET`    | `/imports`      | Job summaries, newest first, without their row reports.                                                                                                                                                                                                                                                                     |
| `GET`    | `/imports/:id`  | One job with the full per-row report.                                                                                                                                                                                                                                                                                       |
| `POST`   | `/orders`       | Places an order. See [Purchase](#purchase) for the body, the `409` shape and the payment outcomes.                                                                                                                                                                                                                          |
| `GET`    | `/orders`       | Order summaries, newest first.                                                                                                                                                                                                                                                                                              |
| `GET`    | `/orders/:id`   | One order with its lines, total, status and the card's last four digits.                                                                                                                                                                                                                                                    |

Ids are uuid v7. Prices are plain numbers in JSON and `Decimal` in the database.

## Decisions

Each change in this repository was planned before it was built: `openspec/changes/<name>/` holds a proposal (why), a design (how, with alternatives considered), a spec delta (what the system must do, as testable scenarios) and a task list. Archived changes live in `openspec/changes/archive/`, and the accumulated behavior contract lives in `openspec/specs/`.

The architectural choices, with the alternatives that were weighed, are in each change's `design.md`: [`scaffold-monorepo`](openspec/changes/archive/2026-09-20-scaffold-monorepo/design.md), [`products-crud-search`](openspec/changes/archive/2026-09-21-products-crud-search/design.md), [`web-design-system`](openspec/changes/archive/2026-09-21-web-design-system/design.md), [`csv-import`](openspec/changes/archive/2026-09-21-csv-import/design.md), [`purchase`](openspec/changes/archive/2026-09-22-purchase/design.md), [`purchase-ux`](openspec/changes/archive/2026-09-22-purchase-ux/design.md) and [`migrate-api-to-python`](openspec/changes/archive/2026-09-22-migrate-api-to-python/design.md). In short:

**Foundation**

- **Separate API and web app, API owns the database.** The web app is client-side rendered and talks to the API over HTTP with a single public base URL. Rejected: Next.js full-stack (couples UI to domain), Server Components fetching from the API (two base URLs, caching semantics that buy nothing for an admin-style UI).
- **The API is Python: FastAPI, Pydantic, SQLAlchemy Core, Alembic.** It started as NestJS with Prisma and was rewritten in Python without changing a route, a status code, a body or the schema; every scenario in `openspec/specs/` held, and the TypeScript tests were ported one for one. FastAPI's routers and dependencies replace Nest's controllers and modules, Pydantic replaces zod, and `typing.Protocol` gives the ports. Rejected: Go (the closest runtime fit, but every port and validator rewritten by hand), Clojure (a redesign rather than a translation of the class-based layering), Litestar (smaller ecosystem for no gain on this contract).
- **PostgreSQL with SQLAlchemy Core (async, psycopg 3), not an ORM.** Transactional guarantees for stock reservation and text-search extensions; the statements that matter (`UPDATE … WHERE stock >= :q RETURNING`, `INSERT … ON CONFLICT`, escaped `ILIKE`) are written as such, and repositories map rows to domain dataclasses. Rejected: the SQLAlchemy ORM (its unit of work and identity map duplicate what the port methods own), SQLModel (merges wire and table models), SQLite (no concurrency semantics).
- **Hexagonal API layout with the frameworks confined to `infra/`.** Business rules are plain Python, constructed directly in unit tests; one factory, `create_app(config)`, builds the engine, repositories and use cases. Pydantic is allowed in `application/` because the import use case validates rows there, the job zod did before. import-linter enforces the boundaries. Rejected: a DI container library (one function is the whole graph).
- **The same validation rules on both sides, kept in step by a shared case table.** The web app validates with the zod schemas in `packages/shared`; the API validates with Pydantic models that reproduce them field for field, down to the messages (strict numbers, so `"29.99"` is not a price; trimming before length checks; decimal places checked as the TypeScript does). `packages/shared/validation-cases/*.json` lists inputs with their expected issues, and both Vitest and pytest run it, so a rule changed on one side fails the other's tests. Rejected: generating one side from the other (Luhn, expiry and decimal-place refinements do not survive an OpenAPI or JSON Schema round trip).
- **OpenAPI generated from the Pydantic models.** FastAPI documents each route from the model it validates with and the error bodies it declares, so `/docs` cannot drift from what the API accepts. Rejected: a hand-written specification (a second contract to keep in sync).
- **Migrations in the API container entrypoint.** `alembic upgrade head` runs before the server, so a fresh `up` on an empty volume needs no extra step and a failing migration stops the API from serving. The revisions execute the original SQL files verbatim, which is what guarantees the schema did not change in the move. Rejected: a separate one-shot migrate service, and autogenerated revisions (they would re-derive the hand-written trigram index and constraints).

**Product catalog**

- **Categories are a table created on demand, keyed by a case-insensitive name.** The category typed on a product is matched against existing ones (`citext` unique column, so `Electronics` and `electronics` are one row) or created. Rejected: a fixed enum (the next data set with a new category would need a code change) and free text on the product (no clean filter).
- **Soft delete with a reserved SKU.** Deleting a product sets `deletedAt`; it disappears from every read and from search, but its row survives so future order lines keep resolving. The SKU stays unique across deleted rows, so a new product cannot silently take an old identity; the API answers `409`. Rejected: hard delete (breaks order history), partial unique index (lets a SKU be reused).
- **Validation rules are the same in the form and the API.** `sku` trimmed and upper-cased, `name` required, `price` a decimal with at most two fraction digits and no currency symbol, `stock` a non-negative integer, `weightKg` optional. The form rejects invalid input before a request is sent; the API rejects it again and reports every failing field at once.
- **Money as `Decimal` in the database, `number` in JSON.** Exact arithmetic where it will matter (order totals), plain numbers where forms and tables bind them. Rejected: strings in JSON (parsing in every field and cell).
- **Search is `ILIKE` with a trigram index, not full-text search.** `q` is a case-insensitive substring match on name and description, with `%` and `_` treated literally, served from a `pg_trgm` GIN index. Rejected: `tsvector` (stemming and ranking buy little for short product names and add query-syntax handling) and a search engine (a fourth container for a problem PostgreSQL solves at this scale).
- **Integration tests hit a real PostgreSQL.** Repository and HTTP tests run against `ecommerce_test`; the behaviors that matter — wildcard escaping, case-insensitive category reuse, soft-delete filtering, unique-violation translation — are SQL behaviors, and mocking the database would test the mock. Use cases are unit-tested with in-memory fakes.
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

Upload a file at `/imports`, or `curl -F file=@data/e-commerce_input.csv http://localhost:5001/imports`. The response, and `GET /imports/{id}` later, is the job with one entry per data row.

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

The sample file `data/e-commerce_input.csv` has 97 data rows and imports as **87 created, 2 skipped, 8 failed**: `$29.99` and `free` as prices, `-5` stock, an empty and a whitespace-only name, and three later duplicates of `RS-001` / `BS-021`. Importing it a second time gives 87 updated. That outcome is asserted by `apps/api/tests/integration/test_imports_http.py`.

## Purchase

Add products to the cart from the products page or a product's page, review the cart at `/cart`, and pay at `/checkout` with a name, an email and a card. The checkout opens ready to submit: the customer fields hold a sample customer and the card selector has the approving test card chosen, so one click places a paid order. The selector also offers the two declining cards and an "Enter another card" option that reveals the card fields. Orders appear at `/orders` and each order has a page with its lines, total, status and card's last four digits. The payment provider is simulated; these are its test cards (any future expiry `MM/YY` and any 3–4 digit security code work when typing one):

| Card number           | Outcome                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `4242 4242 4242 4242` | Approved (as is any other number passing the Luhn check)         |
| `4000 0000 0000 0002` | Declined — "Your card was declined"; stock is put back           |
| `4000 0000 0000 9995` | Declined — "Your card has insufficient funds"; stock is put back |

Endpoints: `POST /orders` (`{ items: [{ productId, quantity }], customer: { name, email }, card: { cardholderName, cardNumber, expiry, cvc } }`; `201` with the order in status `paid` or `payment_failed`; `400` with per-field issues; `409` with `items: [{ productId, requested, available, reason }]` when stock is short or a product is unavailable), `GET /orders` (summaries, newest first) and `GET /orders/{id}`. Limits: 50 lines per order, 100 units per line.

## Security and scope

This is a demonstration system, and it is open on purpose: **there is no authentication, no authorization and no rate limiting**. Anyone who can reach the API can read and write the catalog, import a file and place an order, and `/docs` describes that surface to them. Run it locally; do not expose it to a network as it stands.

What the code does defend, because it shaped how the rest was written:

- **CORS allows exactly one origin**, `WEB_ORIGIN`. The API answers no other browser origin.
- **Every input is validated twice by the same rules** — by zod in the browser before the request is sent, and by Pydantic in the API before the use case runs, with a shared case table keeping the two in step. Domain errors become `400`/`404`/`409` in one set of exception handlers, never a stack trace.
- **Uploads are bounded**: a CSV over 2 MB is rejected with `413` and one over 5,000 data rows with `400`. The file is parsed in memory and never written to disk.
- **User-supplied text is rendered as text.** `dangerouslySetInnerHTML` is rejected by lint, so a product name carrying markup is escaped by React instead of being filtered on the way in.
- **Queries are parameterized by SQLAlchemy**, and the search term has `%` and `_` escaped so it cannot turn into a wildcard scan.
- **No card data is stored.** The number, expiry and security code reach the payment port and nowhere else; the order keeps the last four digits.
- **Both containers run as unprivileged users** (`node` for the web app, `app` for the API), and the API validates its environment at startup rather than booting with a missing `DATABASE_URL`.

Out of scope, with what each would take:

| Not here                              | What it would need                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Accounts, sessions, roles             | An auth layer in front of the API and an owner on every write; the cart is anonymous today |
| Rate limiting and quotas              | A throttler on the API, tighter on `/imports` and `/orders`                                |
| Observability                         | Structured logs with a request id, traces, metrics behind the health check                 |
| A real payment provider               | Webhooks, idempotency keys, and the sweeper for orders left `pending` noted in the design  |
| Refunds, cancellations, shipping, tax | Order state transitions the domain does not model                                          |

Dependencies are watched by Dependabot (npm, uv, GitHub Actions and both Dockerfiles) and by the CodeQL workflow in `.github/`, which analyzes both the TypeScript and the Python code, and `pnpm audit` is clean.

## Status

| Change                  | State    | Delivers                                                                                |
| ----------------------- | -------- | --------------------------------------------------------------------------------------- |
| `scaffold-monorepo`     | archived | monorepo, API + web skeletons, Postgres, Docker, CI, this file                          |
| `products-crud-search`  | archived | `Product`/`Category` model, CRUD API, list + search + form UI                           |
| `web-design-system`     | archived | Tailwind + shadcn/ui, black-and-white typographic UI, detail page                       |
| `csv-import`            | archived | CSV upload, per-row validation report, upsert by SKU                                    |
| `purchase`              | archived | cart, checkout, orders API with stock reservation, fake payment                         |
| `purchase-ux`           | archived | one-click checkout with test-card selector, steppers, confirmed removal, pressed states |
| `migrate-api-to-python` | archived | the API rewritten in Python (FastAPI, SQLAlchemy Core, Alembic) with the same contract  |

Five smaller changes shipped as plain pull requests. None of them added behavior worth a spec, so none got an OpenSpec change of its own:

| Change                  | State  | Delivers                                                                      |
| ----------------------- | ------ | ----------------------------------------------------------------------------- |
| `demo-recordings`       | merged | the two GIFs in [Demo](#demo)                                                 |
| `env-driven-ports`      | merged | `API_PORT` and `WEB_PORT` read from the environment by `pnpm dev` and Compose |
| `ui-interaction-states` | merged | hover, press and focus feedback in every control                              |
| `api-openapi-docs`      | merged | Swagger UI at `/docs`, generated from the routes and the validation schemas   |
| `node-26`               | merged | Node 26 in development, CI and the web image                                  |

## License

[Apache License 2.0](LICENSE). The sample CSV under `data/` is test data, not product data.
