# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A pnpm/Turborepo monorepo (Node 24, pnpm 10.32.1): `apps/api` (NestJS 12 + Prisma 7 on PostgreSQL 16), `apps/web` (Next.js 16 App Router, client-side rendered, TanStack Query, Tailwind v4 + shadcn/ui) and `packages/shared` (zod schemas and types consumed by both apps). `README.md` is the product-level document: run instructions, env vars, every architectural decision with the alternatives that were rejected, and the CSV import contract. Read it before changing behavior.

## Commands

```bash
pnpm install
docker compose up db -d          # Postgres only; needed for `pnpm dev` and the API integration tests
cp .env.example .env
pnpm dev                          # API :5001 (watch) + web :3005; restart after editing packages/shared

pnpm check                        # the CI gate: lint + typecheck + test (all workspaces) + prettier --check
pnpm lint | pnpm typecheck | pnpm test
pnpm format                       # prettier --write .

pnpm --filter api exec vitest run --project unit                 # API unit tests, no database
pnpm --filter api exec vitest run --project integration          # API integration tests (real Postgres)
pnpm --filter api exec vitest run test/products.integration.test.ts
pnpm --filter api exec vitest run src/application/products -t "creates"   # filter by path / test name
pnpm --filter web exec vitest run src/components/imports
pnpm --filter @ecommerce/shared exec vitest run

pnpm --filter api exec prisma migrate dev --name <name>          # new migration (uses DATABASE_URL from .env)
pnpm --filter api db:generate                                    # regenerate client into apps/api/src/generated/prisma
docker compose up --build                                        # full stack; `down -v` for an empty database
```

Turbo runs `db:generate` before build/lint/typecheck/test, so a missing Prisma client after a schema change usually means running that task explicitly. Integration tests use `TEST_DATABASE_URL` (default `ecommerce_test` on the same container); the global setup creates the database and applies migrations, and `test/support/db.ts` `resetDatabase` truncates the tables between tests — add new tables there. Ports are environment-driven (`API_PORT`, `WEB_PORT` in `.env`, read by the `dev` script through `dotenv -e .env` and by Compose); changing one means changing `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` with it, since the API's CORS only allows `WEB_ORIGIN`.

## Lint rules that shape the code

Enforced by `eslint.config.mjs`; violations fail `pnpm check`:

- **No comments** in `apps/*/src`, `apps/*/test`, `packages/*/src` (`eslint-plugin-no-comments`). Put intent in names, types, tests and README. shadcn-generated files must have their comments stripped.
- **API layer boundaries** (`no-restricted-imports`): `domain/` imports nothing from `application/`, `infra/`, `@nestjs/*`, `@prisma/*`; `application/` imports nothing from `infra/`, `generated/` or any framework. Depend on a port in `application/ports/` instead.
- **`import-x/order`** with alphabetized groups and blank lines between them; `eslint --fix` resolves it.
- **No `dangerouslySetInnerHTML`** in the web app — product data is rendered as text (this is the XSS defense; validation deliberately does not filter markup).
- Prettier: single quotes, no semicolons, printWidth 100, tailwind class sorting. `openspec/` is in `.prettierignore`.

## API architecture (hexagonal)

- `src/domain/` — entities, domain errors (`domain/shared/domain-error.ts`: `DomainValidationError`, `NotFoundError`, `ConflictError`, `InvalidImportFileError`). Plain TypeScript.
- `src/application/` — use cases are plain classes taking ports in the constructor (`new CreateProduct(products, categories)`), unit-tested with in-memory fakes in `__fakes__/`. Ports are interfaces plus a `Symbol` injection token in `application/ports/`.
- `src/infra/` — the only place NestJS and Prisma appear. `infra/http/<feature>/*.module.ts` binds ports to Prisma adapters (`{ provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository }`) and constructs use cases with `useFactory`/`inject`; controllers validate bodies with `ZodValidationPipe` over the shared schemas and ids with `ResourceIdPipe` subclasses; `DomainExceptionFilter` maps domain errors to 400/404/409. `infra/persistence/prisma/` holds repositories and mappers.
- Use `@/` imports inside the API (`@/application/ports/config`). Ids are uuid v7; products are soft-deleted (`deletedAt`) with the SKU unique across deleted rows; categories are matched case-insensitively (`citext`) and created on demand.
- Multi-step writes that must be atomic are owned by a single port method that runs the interactive transaction (see `ImportJobRepository.commit`), not by a generic unit-of-work.
- Integration tests in `apps/api/test/` boot the Nest app against real Postgres; do not mock Prisma.

## Web architecture

- Routes under `src/app/` are thin; pages live in `src/components/<feature>/*-page.tsx`. Data access goes through `src/lib/api-client.ts` (`apiClient`, `apiUpload`) and typed modules `products-api.ts` / `imports-api.ts` that also export the query keys (`productKeys`, `importKeys`) used for invalidation.
- The product list keeps search/category/sort/page in the URL (`use-product-list-state.ts`). Every data view has loading, empty, error and not-found states.
- Design: black, white, one gray, no images. Display headings use the `display-heading` utility (Archivo, uppercase); figures (SKU, price, stock, counts) use Geist Mono. Formatting helpers in `src/lib/format.ts`.
- Tests: Vitest + jsdom + Testing Library; `src/test-utils.tsx` provides `renderWithQuery`, `stubApi(routes)` and `calls(fetchMock, method)`.

## Shared package

`packages/shared` exports one zod schema per DTO (`createProductSchema`, `importRowSchema`, `importJobSchema`, …) and the inferred types. Both the API pipe and the web forms validate with the same schema, so a rule change belongs there first.

## Workflow conventions

- Work is planned with OpenSpec (`/opsx:propose`, `/opsx:apply`, `/opsx:archive`; CLI `openspec`). Each change under `openspec/changes/<name>/` has proposal, design, spec deltas and tasks; archived changes go to `openspec/changes/archive/YYYY-MM-DD-<name>/` and the merged behavior contract is `openspec/specs/`. When adding a change, update the README "Decisions" and "Status" sections.
- Flow per change: propose → apply on a `feat/<name>` branch → PR to `main` with granular conventional commits → merge → archive (spec sync + README status) committed directly on `main`.
- Everything committed to the repository — code, specs, docs, commit messages — is written in English. Conversation with the maintainer is in Portuguese. Do not describe the project as an assessment or challenge anywhere except the paragraph already in `README.md`.
- `data/e-commerce_input.csv` is a fixture asserted by `apps/api/test/imports.integration.test.ts` (87 created / 2 skipped / 8 failed); do not edit it.
