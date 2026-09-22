# Tasks

## 1. Python project scaffold

- [x] 1.1 Create `apps/api/pyproject.toml` (Python 3.14; fastapi, uvicorn, pydantic, python-multipart, sqlalchemy[asyncio], psycopg[binary], alembic; dev: pytest, pytest-asyncio, httpx, mypy, ruff, import-linter) and the `src/ecommerce_api` package skeleton (`domain`, `application/{ports,schemas,products,imports,orders}`, `infra/{http,persistence,payments}`). Verify that `uv sync` creates `uv.lock` and `uv run python -c "import ecommerce_api"` succeeds.
- [x] 1.2 Configure Ruff (lint with import sorting, and format) and mypy `--strict` with the Pydantic plugin in `pyproject.toml`. Verify that `uv run ruff check`, `uv run ruff format --check` and `uv run mypy` pass on the skeleton.
- [x] 1.3 Add import-linter contracts: the layers `infra` > `application` > `domain`; `fastapi`, `starlette`, `sqlalchemy`, `psycopg` and `alembic` forbidden in `domain` and `application`; `pydantic` forbidden in `domain`. Verify that `uv run lint-imports` passes, and fails on a temporary `import sqlalchemy` in `application/`.
- [x] 1.4 Write `scripts/check_sources.py`, which rejects `#` comments (tokenize) and docstrings (ast) under `src/`, `tests/` and `migrations/` and prints `path:line`. Verify that it passes on the tree and fails, naming the line, on a temporary comment and on a temporary docstring.

## 2. Domain and validation schemas

- [x] 2.1 Port the domain as frozen dataclasses and helpers: `Product`, `Category`, `normalize_sku`, `normalize_category_name`, the import job types and `count_outcomes`, the order types, and `line_total` / `compute_totals` on `Decimal`. Port the domain errors (`DomainValidationError`, `NotFoundError`, `ConflictError`, `UnavailableItemsError`, `InvalidImportFileError`). Verify with the pytest port of `domain/order/order.test.ts`, including `3 × 19.99 = 59.97`.
- [x] 2.2 Add `packages/shared/validation-cases/{product,import-row,order}.json` (input plus expected validity, or the issue paths and messages), covering every rule and message in `product.schema.ts`, `import.schema.ts` and `order.schema.ts`. Add a Vitest test in `packages/shared` that runs the table against the zod schemas. Verify with `pnpm --filter @ecommerce/shared exec vitest run`.
- [x] 2.3 Implement the product input models in `application/schemas/product.py`: create, partial update that tells absent from `null`, and the list query with defaults and bounds. Use strict numbers, trim then check lengths, upper-case the SKU, check decimal places the TypeScript way, and use zod's messages verbatim through a per-field message table. Verify that the product cases in the shared table pass under pytest, along with the ported `product.schema.test.ts`.
- [x] 2.4 Implement the import row model: preprocess the cells (blank means absent for the required cells and `null` for the optional ones, and a non-decimal numeric cell is kept as text so it fails the type check), then apply the product rules. Verify with the import-row cases in the shared table and the ported `import.schema.test.ts`.
- [x] 2.5 Implement the order input model: items (1–50, quantity 1–100, no repeated product with the issue on `items`), customer (zod's email pattern), and card (spaces stripped from the number, 13–19 digits, Luhn, `MM/YY` not expired against an injectable clock, 3–4 digit CVC). Include the test cards. Verify with the order cases in the shared table and the ported `order.schema.test.ts`, including `card.cardNumber`, `card.expiry` and `items.0.quantity` paths.

## 3. Application layer

- [x] 3.1 Define the ports as `typing.Protocol`s: product, category, import job, order, payment gateway and config. Add in-memory fakes under `tests/unit/fakes/`. Verify with `mypy` and `lint-imports`.
- [x] 3.2 Port the product use cases (create, get, update, delete, list, list categories). Verify with the pytest port of `application/products/products.test.ts`.
- [x] 3.3 Port `parse_csv` on the standard `csv` module: `utf-8-sig` decode (a non-UTF-8 file becomes `InvalidImportFileError`), `strict=True`, normalized headers, missing columns reported together, no data rows, blank-row detection, and line numbers corrected for embedded newlines. Verify with the pytest port of `parse-csv.test.ts`.
- [x] 3.4 Port `ImportProducts` (the 5,000-row limit, skipped and failed rows, duplicate SKU pointing at the first line, a plan that keeps absent columns out of the write), `GetImportJob` and `ListImportJobs`. Verify with the pytest port of `imports.test.ts`.
- [x] 3.5 Port `PlaceOrder` (last four digits, charge outside the reservation, a gateway exception becomes a decline with `Payment provider unavailable`), `GetOrder` and `ListOrders`, and the fake payment gateway. Verify with the pytest ports of `orders.test.ts` and `fake-payment-gateway.test.ts`.

## 4. Persistence

- [x] 4.1 Move the four Prisma `migration.sql` files to `apps/api/migrations/sql/` unchanged. Add `alembic.ini`, `migrations/env.py` (URL from the environment) and revisions `0001`–`0004` that execute them. Verify that `alembic upgrade head` on an empty database produces a schema identical to the Prisma one: `pg_dump --schema-only` of both differs only in the migrations bookkeeping table.
- [x] 4.2 Add the pytest integration support: a session fixture that drops and recreates `TEST_DATABASE_URL`'s database and runs `alembic upgrade head`, and a per-test truncate of `OrderLine`, `Order`, `Product`, `Category` and `ImportJob`. Verify that an empty integration test passes on a fresh `ecommerce_test`.
- [x] 4.3 Declare the SQLAlchemy Core tables and the async engine factory. Implement the category repository (find-or-create by `INSERT … ON CONFLICT DO NOTHING RETURNING` plus `SELECT`, keeping the stored spelling; list ordered by name). Verify with the port of `prisma-category.repository.integration.test.ts`.
- [x] 4.4 Implement the product repository: uuid7 ids, explicit `updatedAt`, SQLSTATE 23505 on the SKU becomes `ConflictError`, soft delete, and search with escaped `ILIKE`, the category filter, sort plus id tiebreak, and page, limit and total. Verify with the port of `prisma-product.repository.integration.test.ts`, including the literal `%`/`_` and soft-delete cases.
- [x] 4.5 Implement the import job repository: `commit` in one transaction (existing-SKU lookup, category resolution, upsert that restores deleted products and leaves absent columns untouched, rows sorted by line, counters, JSONB report), plus `find_by_id` and `find_all` newest first. Verify with the port of `prisma-import-job.repository.integration.test.ts`.
- [x] 4.6 Implement the order repository: `reserve` (a conditional `UPDATE … RETURNING` per item in `productId` order, a problem list for `UnavailableItemsError`, snapshot lines and a `Decimal` total, status `pending`), `settle` (paid with the reference, or `payment_failed` with the reason and the stock put back), `find_by_id` and `find_all`. Verify with the port of `prisma-order.repository.integration.test.ts`, including the concurrent-oversell case run with `asyncio.gather` over separate connections.

## 5. HTTP layer

- [x] 5.1 Implement `infra/config.py` with a Pydantic model over the environment (`DATABASE_URL` required; `API_PORT` 5001 and `WEB_ORIGIN` `http://localhost:3005` by default). On invalid input it exits naming each bad variable, then `create_app(config)` wires the engine, repositories and use cases, adds CORS for the single origin, and sets `/docs` and `/docs/json`. Verify with the port of `env-config.test.ts` and by running `python -m ecommerce_api` without `DATABASE_URL`, which must exit non-zero with `DATABASE_URL` in the message.
- [x] 5.2 Add the error handlers: domain errors to 400/404/409 with the Nest bodies, `RequestValidationError` to `400 { message: 'Validation failed', issues }` with the `body`/`query` prefix dropped from paths, and the uuid path parameter to `404` with the resource name. Add the response models with camelCase aliases and `YYYY-MM-DDTHH:MM:SS.mmmZ` timestamps. Verify with the ports of `domain-exception.filter.test.ts` and `zod-validation.pipe.test.ts`.
- [x] 5.3 Implement `/health`, returning the Terminus-shaped report with `200` or `503`. Verify with the port of `health.integration.test.ts`, including the unreachable-database case.
- [x] 5.4 Implement the `/products` and `/categories` routers. Verify with the port of `products.integration.test.ts` (validation issues, 409 on SKU including deleted, partial update, 204 delete, list query bounds).
- [x] 5.5 Implement `/imports`: the body-size guard answering `413 { message, error: 'Payload Too Large', statusCode: 413 }`, in-memory multipart with the spool threshold above the limit, the exact 2 MB check on the file part, and a missing `file` giving `InvalidImportFileError`. Add the list and get routes. Verify with the port of `imports.integration.test.ts`, including `data/e-commerce_input.csv` giving 87 created / 2 skipped / 8 failed, then 87 updated on re-import, and the 413 case.
- [x] 5.6 Implement the `/orders` routers. Verify with the port of `orders.integration.test.ts` (201 paid, 201 `payment_failed` with stock restored, 409 items body, 400 issue paths, history newest first).
- [x] 5.7 Declare the success and error responses on each route, and the `413` on `/imports`, so the OpenAPI document matches the Nest one. Verify with the port of `openapi.integration.test.ts` against `/docs/json`.

## 6. Monorepo, CI and container

- [x] 6.1 Rewrite `apps/api/package.json` as `uv run` wrappers: `lint` (ruff check, ruff format --check, lint-imports, check_sources), `lint:fix`, `typecheck` (mypy), `test` (pytest) and `dev` (uvicorn reload on `API_PORT`). Drop the `@ecommerce/shared` dependency. Remove the `db:generate` task and its `dependsOn` edges from `turbo.json`. Have ESLint and Prettier ignore `apps/api`. Verify with `pnpm check` and `pnpm dev`, then open `http://localhost:3005` against the Python API.
- [x] 6.2 Rewrite `apps/api/Dockerfile` on `python:3.14-slim`: uv from its official image, `uv sync --locked --no-dev` in a build stage, a non-root `app` user, and `alembic upgrade head && exec python -m ecommerce_api`. Change the Compose API healthcheck to a `python -c` urllib request. Verify that `docker compose down -v && docker compose up --build` reports all three services healthy.
- [ ] 6.3 Add `astral-sh/setup-uv` with Python 3.14 to `.github/workflows/ci.yml` ahead of `pnpm check`. Add `python` to the CodeQL languages, and the `uv` ecosystem for `/apps/api` to `.github/dependabot.yml`. Verify that the PR's CI run is green, with both jobs and CodeQL passing.

## 7. Remove the NestJS implementation

- [x] 7.1 Delete the TypeScript API: `apps/api/src/**/*.ts`, `apps/api/test/`, `prisma/`, `prisma.config.ts`, `nest-cli.json`, `tsconfig*.json`, `vitest.config.ts`, `dist/` and `src/generated/`. Remove the Prisma, SWC and Nest entries from the root `pnpm.overrides` and ESLint config that only served the API, then refresh `pnpm-lock.yaml`. Verify that `pnpm install --frozen-lockfile` and `pnpm check` pass and that `grep -ri "nestjs\|prisma" --exclude-dir=node_modules --exclude-dir=openspec .` finds nothing outside the README history notes.
- [x] 7.2 Remove `env/api-env.ts`, its test and its exports from `packages/shared`. Verify with `pnpm --filter @ecommerce/shared exec vitest run` and `pnpm --filter web typecheck`.

## 8. Documentation

- [x] 8.1 Update the README:
  - intro, demo captions, prerequisites (Python 3.14 and uv), development and test commands, quality gate and lint rules, layout;
  - API section (`/docs` generated by FastAPI);
  - Decisions: Foundation rewritten for FastAPI, Pydantic, SQLAlchemy Core and Alembic, with the rejected alternatives from this design; validation shared by rules plus a case table instead of one zod schema; the `node` user note replaced;
  - Security;
  - the one-time `docker compose down -v` note;
  - Status: `migrate-api-to-python`.

  Verify that `pnpm format:check` passes and that every command in the README runs as written.
- [x] 8.2 Update `CLAUDE.md` (stack line, commands, lint rules, API architecture section, test commands) to describe the Python API. Verify that the new API commands listed there run as written.

## 9. End-to-end verification

- [ ] 9.1 With `docker compose down -v && docker compose up --build`:
  - import `data/e-commerce_input.csv` from the web app and check the report;
  - search and filter the catalog, then create, edit and delete a product;
  - place a paid order and a declined order and check the stock on each;
  - force a `409` by buying more than the stock;
  - open `/docs`.

  Verify that every step behaves as in the demo recordings and that `pnpm --filter web test` passes unchanged.
