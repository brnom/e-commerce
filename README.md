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

`pnpm dev` starts the API on port 3001 with hot reload and the web app on port 3000. The Prisma client is generated automatically as part of the Turborepo task graph.

## Quality gate

```bash
pnpm check
```

Runs, for every workspace: ESLint, `tsc --noEmit`, Vitest, and a Prettier check. The same command runs in CI on every push and pull request (`.github/workflows/ci.yml`), together with a build of both Docker images.

Two lint rules are worth knowing about:

- **No comments in source files.** Intent is expected to live in names, types, tests and this document. The rule is enforced with `eslint-plugin-no-comments` on everything under `apps/*/src`, `apps/*/test` and `packages/*/src`.
- **`@/` imports in the API.** `@/application/ports/config` instead of `../../application/ports/config`. The Nest CLI compiles with SWC so the alias is rewritten in the emitted JavaScript; `tsc --noEmit` still type-checks every build.
- **Layer boundaries in the API.** `domain/` may not import `application/` or `infra/`; `application/` may not import `infra/` or any framework. Enforced with `no-restricted-imports`, so a violation fails `pnpm lint`.

## Environment variables

Defaults work for local development and for Compose. A committed `.env.example` documents every variable.

| Variable              | Used by      | Default                                         | Purpose                                            |
| --------------------- | ------------ | ----------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`        | api          | `postgresql://app:app@localhost:5432/ecommerce` | PostgreSQL connection string. Required.            |
| `API_PORT`            | api          | `3001`                                          | HTTP port the API listens on.                      |
| `WEB_ORIGIN`          | api          | `http://localhost:3000`                         | Origin allowed by CORS.                            |
| `NEXT_PUBLIC_API_URL` | web          | `http://localhost:3001`                         | API base URL as seen from the browser. Build-time. |
| `POSTGRES_USER`       | compose (db) | `app`                                           | Database user.                                     |
| `POSTGRES_PASSWORD`   | compose (db) | `app`                                           | Database password.                                 |
| `POSTGRES_DB`         | compose (db) | `ecommerce`                                     | Database name.                                     |

The API validates its environment at startup and exits with a non-zero status naming any missing or malformed variable.

## Repository layout

```
apps/
  api/                 NestJS REST API
    src/domain/        entities, value objects, domain errors (no framework imports)
    src/application/   ports (interfaces + injection tokens) and use cases
    src/infra/ NestJS modules, HTTP controllers/pipes/filters, Prisma adapters, env config
    src/main.ts        bootstrap; with app.module.ts, the composition root
    prisma/            schema and migrations
    test/              integration tests that boot the Nest application
  web/                 Next.js App Router application, client-side rendered
packages/
  shared/              zod schemas and TypeScript types used by both apps
openspec/              change proposals, designs, specs and task lists (spec-driven workflow)
docker-compose.yml     db + api + web
```

## Decisions

Each change in this repository was planned before it was built: `openspec/changes/<name>/` holds a proposal (why), a design (how, with alternatives considered), a spec delta (what the system must do, as testable scenarios) and a task list. Archived changes live in `openspec/changes/archive/`, and the accumulated behavior contract lives in `openspec/specs/`.

The main architectural choices so far, with the alternatives that were weighed, are in [`openspec/changes/archive/2026-09-20-scaffold-monorepo/design.md`](openspec/changes/archive/2026-09-20-scaffold-monorepo/design.md). In short:

- **Separate API and web app, API owns the database.** The web app is client-side rendered and talks to the API over HTTP with a single public base URL. Rejected: Next.js full-stack (couples UI to domain), Server Components fetching from the API (two base URLs, caching semantics that buy nothing for an admin-style UI).
- **PostgreSQL + Prisma 7.** Transactional guarantees for stock reservation and text-search extensions later; migrations that run identically locally, in CI and in the container. Rejected: TypeORM (entities drift), Drizzle (younger Nest story), SQLite (no concurrency semantics).
- **Hexagonal API layout with NestJS confined to `infra/`.** Business rules are plain TypeScript, constructed directly in unit tests; Nest modules bind ports to adapters. Rejected: Nest's conventional feature-module layout (rules end up decorated and coupled to Nest and Prisma).
- **One zod schema per DTO, shared by API and web.** Rejected: class-validator (cannot be consumed by the browser), OpenAPI codegen (a build step for one team).
- **Migrations in the API container entrypoint.** A fresh `up` on an empty volume needs no extra step, and a failing migration stops the API from serving. Rejected: a separate one-shot migrate service.

## Sample data

The example product CSV used to exercise the import was downloaded on **2026-09-20**. It ships in this repository under `data/` once the CSV import change lands.

## Status

| Change                 | State    | Delivers                                                       |
| ---------------------- | -------- | -------------------------------------------------------------- |
| `scaffold-monorepo`    | archived | monorepo, API + web skeletons, Postgres, Docker, CI, this file |
| `products-crud-search` | planned  | `Product`/`Category` model, CRUD API, list + search + form UI  |
| `csv-import`           | planned  | CSV upload, per-row validation report, upsert by SKU           |
| `purchase`             | planned  | orders, stock reservation, fake payment provider, purchase UI  |
