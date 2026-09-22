# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A pnpm/Turborepo monorepo (Node 26, pnpm 10.32.1): `apps/api` (Python 3.14 with uv: FastAPI + Pydantic v2 + SQLAlchemy 2 Core async on psycopg 3 + Alembic, PostgreSQL 16), `apps/web` (Next.js 16 App Router, client-side rendered, TanStack Query, Tailwind v4 + shadcn/ui) and `packages/shared` (zod schemas and types used by the web app, plus `validation-cases/*.json` run by both the Vitest and the pytest suites). `README.md` is the product-level document: run instructions, env vars, every architectural decision with the alternatives that were rejected, and the CSV import contract. Read it before changing behavior.

## Commands

```bash
pnpm install
docker compose up db -d          # Postgres only; needed for `pnpm dev` and the API integration tests
cp .env.example .env
pnpm db:migrate                   # alembic upgrade head on DATABASE_URL from .env
pnpm dev                          # API :5001 (uvicorn --reload) + web :3005

pnpm check                        # the CI gate: lint + typecheck + test (all workspaces) + prettier --check
pnpm lint | pnpm typecheck | pnpm test
pnpm format                       # prettier --write . (the API formats with `uv run ruff format .`)

cd apps/api
uv run pytest tests/unit                                          # API unit tests, no database
uv run pytest tests/integration                                   # API integration tests (real Postgres)
uv run pytest tests/integration/test_products_http.py -k creates  # filter by file / test name
uv run ruff check . && uv run mypy && uv run lint-imports && uv run python scripts/check_sources.py
pnpm --filter web exec vitest run src/components/imports
pnpm --filter @ecommerce/shared exec vitest run

docker compose up --build                                        # full stack; `down -v` for an empty database
```

New migration: add `apps/api/migrations/sql/<timestamp>_<name>.sql` with the DDL and a revision in `migrations/versions/` that runs it (copy an existing one; `script.py.mako` is the template), then mirror the change in `infra/persistence/tables.py`. Integration tests use `TEST_DATABASE_URL` (default `ecommerce_test` on the same container); the session fixture in `tests/integration/conftest.py` drops and recreates that database and runs `alembic upgrade head`, and `reset_database` truncates the tables between tests — add new tables to `TABLES` there. Ports are environment-driven (`API_PORT`, `WEB_PORT` in `.env`, read by the `dev` script through `dotenv -e .env` and by Compose); changing one means changing `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` with it, since the API's CORS only allows `WEB_ORIGIN`. A development database migrated by the old Prisma setup has to be recreated once (`docker compose down -v`).

## Lint rules that shape the code

Violations fail `pnpm check`:

- **No comments** anywhere in source: `eslint-plugin-no-comments` on `apps/web/src` and `packages/*/src`; `apps/api/scripts/check_sources.py` rejects every `#` comment and every docstring in `apps/api/{src,tests,migrations,scripts}` (so no `# type: ignore` or `# noqa` either — fix the type instead). Put intent in names, types, tests and README. shadcn-generated files must have their comments stripped.
- **API layer boundaries** (import-linter contracts in `apps/api/pyproject.toml`): `domain/` imports nothing from `application/` or `infra/` and no framework, not even Pydantic; `application/` imports nothing from `infra/` and none of FastAPI, Starlette, SQLAlchemy, psycopg, Alembic. Depend on a `Protocol` in `application/ports/` instead.
- **Python style**: Ruff (lint with import sorting, format with single quotes, line length 100), mypy `--strict` with the Pydantic plugin, absolute imports only (`from ecommerce_api.… import …`).
- **`import-x/order`** with alphabetized groups and blank lines between them in TypeScript; `eslint --fix` resolves it.
- **No `dangerouslySetInnerHTML`** in the web app — product data is rendered as text (this is the XSS defense; validation deliberately does not filter markup).
- Prettier: single quotes, no semicolons, printWidth 100, tailwind class sorting. `openspec/` and `apps/api` are in `.prettierignore`.

## API architecture (hexagonal)

Package `apps/api/src/ecommerce_api`:

- `domain/` — frozen dataclasses, money on `Decimal`, domain errors (`domain/errors.py`: `DomainValidationError`, `NotFoundError`, `ConflictError`, `UnavailableItemsError`, `InvalidImportFileError`). Plain Python.
- `application/` — use cases are plain classes taking ports in the constructor (`CreateProduct(products, categories)`, `await use_case.execute(...)`), unit-tested with in-memory fakes in `tests/unit/fakes/`. Ports are `typing.Protocol`s in `application/ports/`. `application/schemas/` holds the Pydantic input models (the counterpart of the zod schemas) built on `schemas/rules.py`, which reproduces zod's checks and messages; `ImportProducts` validates CSV rows with them.
- `infra/` — the only place FastAPI and SQLAlchemy appear. `infra/http/app.py` `create_app(config)` is the composition root (`container.py` builds engine, repositories, use cases; routers get them through `Depends(container)`). Routers in `infra/http/routes/` take the input models as bodies/queries, check ids with `routes/resource_ids.py` (malformed uuid → 404), and map domain objects to camelCase response models in `responses.py`. `errors.py` maps domain errors and `RequestValidationError` to the `400`/`404`/`409`/`413` bodies. `infra/persistence/` holds the Core tables and repositories.
- Ids are uuid v7 (`uuid.uuid7()`), `updatedAt` is set explicitly on every write, products are soft-deleted (`deletedAt`) with the SKU unique across deleted rows, categories are matched case-insensitively (`citext`) and created on demand. Timestamps serialize as `YYYY-MM-DDTHH:MM:SS.mmmZ`, money as JSON numbers.
- Multi-step writes that must be atomic are owned by a single port method that runs the transaction (see `ImportJobRepository.commit`), not by a generic unit-of-work.
- Integration tests in `apps/api/tests/integration/` drive the app through `httpx.AsyncClient(transport=ASGITransport(app))` against real Postgres; do not mock the database.

## Web architecture

- Routes under `src/app/` are thin; pages live in `src/components/<feature>/*-page.tsx`. Data access goes through `src/lib/api-client.ts` (`apiClient`, `apiUpload`) and typed modules `products-api.ts` / `imports-api.ts` that also export the query keys (`productKeys`, `importKeys`) used for invalidation.
- The product list keeps search/category/sort/page in the URL (`use-product-list-state.ts`). Every data view has loading, empty, error and not-found states.
- Design: black, white, one gray, no images. Display headings use the `display-heading` utility (Archivo, uppercase); figures (SKU, price, stock, counts) use Geist Mono. Formatting helpers in `src/lib/format.ts`.
- Tests: Vitest + jsdom + Testing Library; `src/test-utils.tsx` provides `renderWithQuery`, `stubApi(routes)` and `calls(fetchMock, method)`.

## Shared package

`packages/shared` exports one zod schema per DTO (`createProductSchema`, `importRowSchema`, `importJobSchema`, …) and the inferred types, used by the web forms. The API reproduces the same rules in `apps/api/src/ecommerce_api/application/schemas/`. A rule change touches three places: the zod schema, the Pydantic model, and a case in `packages/shared/validation-cases/*.json`, which both test suites run.

## Workflow conventions

- Work is planned with OpenSpec (`/opsx:propose`, `/opsx:apply`, `/opsx:archive`; CLI `openspec`). Each change under `openspec/changes/<name>/` has proposal, design, spec deltas and tasks; archived changes go to `openspec/changes/archive/YYYY-MM-DD-<name>/` and the merged behavior contract is `openspec/specs/`. When adding a change, add its design link and its main decisions to README "Decisions" and update the count in README "Status". A change with no new behavior to specify — a README edit, a default that moves to the environment, a visual pass over existing controls — ships as a plain PR and needs no README entry.
- Flow per change: propose → apply on a `feat/<name>` branch → PR to `main` with granular conventional commits → merge → archive (spec sync + README status) committed directly on `main`.
- Everything committed to the repository — code, specs, docs, commit messages — is written in English. Conversation with the maintainer is in Portuguese. Do not describe the project as an assessment or challenge anywhere except the paragraph already in `README.md`.
- `data/e-commerce_input.csv` is a fixture asserted by `apps/api/tests/integration/test_imports_http.py` (87 created / 2 skipped / 8 failed); do not edit it.
