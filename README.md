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
    src/infra/         NestJS modules, HTTP controllers/pipes/filters, Prisma adapters, env config
    src/main.ts        bootstrap; with app.module.ts, the composition root
    prisma/            schema and migrations
    test/              integration tests that boot the Nest application
  web/                 Next.js App Router application, client-side rendered
    src/app/           routes (/, /products, /products/new, /products/[id]/edit)
    src/components/    product table, filters, form, delete control
    src/lib/           API client, typed product endpoints, URL state for the list
packages/
  shared/              zod schemas and TypeScript types used by both apps
openspec/              change proposals, designs, specs and task lists (spec-driven workflow)
docker-compose.yml     db + api + web
```

## Decisions

Each change in this repository was planned before it was built: `openspec/changes/<name>/` holds a proposal (why), a design (how, with alternatives considered), a spec delta (what the system must do, as testable scenarios) and a task list. Archived changes live in `openspec/changes/archive/`, and the accumulated behavior contract lives in `openspec/specs/`.

The architectural choices, with the alternatives that were weighed, are in each change's `design.md`: [`scaffold-monorepo`](openspec/changes/archive/2026-09-20-scaffold-monorepo/design.md) and [`products-crud-search`](openspec/changes/archive/2026-09-21-products-crud-search/design.md). In short:

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

## Sample data

The example product CSV used to exercise the import was downloaded on **2026-09-20**. It ships in this repository under `data/` once the CSV import change lands.

## Status

| Change                 | State    | Delivers                                                       |
| ---------------------- | -------- | -------------------------------------------------------------- |
| `scaffold-monorepo`    | archived | monorepo, API + web skeletons, Postgres, Docker, CI, this file |
| `products-crud-search` | archived | `Product`/`Category` model, CRUD API, list + search + form UI  |
| `csv-import`           | planned  | CSV upload, per-row validation report, upsert by SKU           |
| `purchase`             | planned  | orders, stock reservation, fake payment provider, purchase UI  |
