# Design

## Context

`apps/api` is a NestJS 12 application with Prisma 7, laid out hexagonally:

- `domain/` holds plain types and domain errors.
- `application/` holds use cases that take ports in their constructor.
- `infra/` holds Nest modules, controllers, pipes, the exception filter, Prisma repositories, the fake payment gateway and the environment config.

Validation lives in the zod schemas of `packages/shared`. Three places use them: the API's validation pipe, the import use case (`importRowSchema`) and the web forms. The behavior contract is `openspec/specs/` (see the proposal for why the language changes). Beyond the specs, the web app depends on details they leave open:

- the error body shapes, which `apps/web/src/lib/api-client.ts` parses as JSON for every non-2xx response, the `413` included;
- camelCase field names;
- timestamps as strings;
- the messages in `issues`, which the forms display.

The schema lives in four Prisma SQL migrations. It uses `citext`, `pg_trgm` (a GIN trigram index on name and description), an `OrderStatus` enum, `Decimal(12,2)` money, and `updatedAt` columns without a database default, because Prisma sets them from the client.

## Goals / Non-Goals

**Goals:**

- Behavior equivalent to the Nest API on every route. The TypeScript integration and unit tests are ported scenario by scenario.
- Keep the hexagonal layering, now enforced by a tool rather than by convention.
- Keep one quality gate (`pnpm check`) and a one-command stack (`docker compose up`).

**Non-Goals:**

- Changing any endpoint, status code, body shape, validation rule or message.
- Changing the database schema, or adding indexes and constraints.
- Touching `apps/web`, apart from nothing breaking.
- Performance work, new features, or authentication.

## Decisions

### Layout

```
apps/api/
  pyproject.toml  uv.lock  alembic.ini  package.json (uv wrappers for turbo)
  migrations/     env.py, versions/0001…0004 running the carried-over SQL files
  src/ecommerce_api/
    domain/         dataclasses, money helpers, domain errors
    application/
      ports/        typing.Protocol interfaces
      schemas/      Pydantic input models: the Python counterpart of packages/shared
      products/ imports/ orders/   use cases
    infra/
      config.py     environment validated by a Pydantic model
      http/         app factory, routers, response models, error handlers, upload guard
      persistence/  SQLAlchemy Core tables, repositories, engine
      payments/     fake gateway
    __main__.py     reads config, runs uvicorn
  tests/
    unit/           use cases with in-memory fakes, schemas, CSV parser, domain
    integration/    repositories and HTTP against real Postgres
  scripts/check_sources.py   no-comments / no-docstrings check
```

Imports are absolute (`ecommerce_api.application.ports.config`), which replaces the `@/` alias. Unlike `__fakes__/` in the TypeScript tree, the fakes live under `tests/`, so they never ship in the image.

### FastAPI + Pydantic v2, with Pydantic allowed in `application/`

FastAPI takes over from Nest. Pydantic models replace zod.

- **Input models** live in `application/schemas/`. The import use case validates rows in the application layer, exactly as it did with `importRowSchema`, and zod was already a library the application layer imported.
- **Response models** (camelCase aliases, timestamp serialization) live in `infra/http/`, because they are wire format.

Alternatives rejected:

- Plain dataclasses with hand-written validation: a second validation engine to maintain.
- Pydantic kept only in `infra/`: the import use case would need a port just to validate a row.
- Litestar: smaller ecosystem, with no gain on this contract.

### Parity with the zod rules

Pydantic's defaults differ from zod's in ways the specs can see, so every field is declared explicitly.

- **No string-to-number coercion.** Pydantic lax mode accepts `"29.99"` for a float; zod rejects it. Number fields are strict: they accept JSON ints and floats and reject strings and booleans. `stock` and `quantity` also accept integral floats (`5.0`), as zod's `.int()` does.
- **Trimming happens before the length checks.** `sku` is then upper-cased.
- **Decimal places are checked the way the TypeScript does it**, `round(value * 10**n) / 10**n == value`, so the IEEE float results match.
- **Messages are zod's, verbatim.** Each field has a rule function (`application/schemas/rules.py`) that runs zod's checks in zod's order and raises every failing message at once, so `-1.234` as a price reports both the minimum and the decimal places, as zod does. A model-level validator marks absent required fields with a sentinel before the rules run, so a missing field gets the field's own message (`SKU is required`) instead of Pydantic's `Field required`.
- **Issue paths** are `loc` without the leading `body`/`query` segment, joined with `.` (`items.0.quantity`, `card.cvc`). A top-level shape error has the empty path.
- **Duplicate products in an order** are a validator on `items`, so the issue path is `items`.
- **Email** is checked with the same pattern zod's `z.email()` uses, not `email-validator`, which accepts and rejects a different set of addresses.
- **Card expiry** takes an injectable clock, like `createPlaceOrderSchema(now)`.
- **Partial update** tells "absent" from `null` by `model_fields_set`. `null` clears a field; absent leaves it unchanged.
- **Unknown keys** are ignored, as zod strips them.

The rules also stay in zod for the web app. To keep the two copies honest, `packages/shared/validation-cases/*.json` lists inputs with the expected outcome (valid, or the issue paths and messages). Vitest in `packages/shared` and pytest in `apps/api` both run the table. Rejected: generating one side from the other with OpenAPI to zod or JSON Schema to Pydantic, because refinements (Luhn, expiry, decimal places) do not survive the round trip.

### SQLAlchemy 2 Core (async) on psycopg 3, not the ORM

Tables are declared with `sqlalchemy.Table` to mirror the existing schema. Repositories write explicit statements: `UPDATE … WHERE stock >= :q RETURNING …` for reservation, `INSERT … ON CONFLICT` for the import upsert, `ILIKE … ESCAPE` for search. Repositories map rows to domain dataclasses, the job Prisma's `select` plus mappers did. Everything runs on an `AsyncEngine`, because the order flow awaits the payment provider between its two transactions.

Alternatives rejected:

- The SQLAlchemy ORM: its unit of work and identity map duplicate what the port methods already own, and the statements that matter are hand-shaped anyway.
- SQLModel: it merges the wire and table models, which the layering keeps apart.
- Raw psycopg: loses composable query building for the search filters.

Behaviors Prisma used to supply, now explicit:

- `updatedAt` is set on every insert and update.
- Ids are generated in the application with `uuid.uuid7()` (Python 3.14 standard library).
- A unique violation on `Product_sku_key` (SQLSTATE `23505`) becomes `ConflictError('sku', sku)`.
- Search escapes `\`, `%` and `_` and uses `ILIKE '%' || :q || '%' ESCAPE '\'` on name or description.
- Find-or-create for categories is `INSERT … ON CONFLICT (name) DO NOTHING RETURNING`, followed by a `SELECT` when nothing was returned. The stored spelling of an existing category is never rewritten.
- The product list sorts by `(sort field, id)` and orders by `(createdAt desc, id desc)`, as before.

### Migrations: Alembic running the existing SQL verbatim

The four `migration.sql` files move to `apps/api/migrations/sql/`. Revisions `v0001`–`v0004` each run their file through `migrations/sql_file.py` (`exec_driver_sql`, so the text is sent as written). Carrying the text over, instead of re-deriving the DDL, is what guarantees the schema is unchanged: index names, the `ON DELETE` rules, the enum. The container runs `alembic upgrade head`, then execs the server, so a failed migration still exits non-zero before anything listens.

Alternatives rejected:

- Autogenerated Alembic revisions: they would rename or drop things the SQL defined by hand, such as the trigram index.
- A bespoke SQL runner: Alembic is what a Python reviewer expects.

An existing database migrated by Prisma is not adopted automatically. It has to be recreated once (see Migration Plan).

### HTTP details carried over

- **Error handlers** map `DomainValidationError`, `NotFoundError`, `ConflictError`, `UnavailableItemsError` and `InvalidImportFileError` to the same status codes and bodies as `DomainExceptionFilter`. `RequestValidationError` becomes `400 { message: 'Validation failed', issues }` instead of FastAPI's `422`.
- **A malformed id** in a path answers `404` with the resource name, as `ResourceIdPipe` did.
- **Timestamps** are serialized as `YYYY-MM-DDTHH:MM:SS.mmmZ`, the format of JavaScript's `toISOString`, so the web app sees what it saw before.
- **Upload limits.** A guard reads the raw request body with a cap. Past 2 MB plus a fixed multipart allowance it answers `413 { message, error: 'Payload Too Large', statusCode: 413 }` before parsing. The multipart parser's spool threshold is raised above the limit, so the file never reaches disk. The file part's exact size is checked again against 2 MB.
- **A file that is not UTF-8** is an invalid import file (`400`).
- **Health** keeps the Terminus report shape: `{ status, info, error, details }` with a `database` indicator, `200` when `SELECT 1` succeeds and `503` otherwise.
- **OpenAPI.** `docs_url='/docs'` and `openapi_url='/docs/json'`. Response models and the error bodies are declared on each route, so the document lists the same responses the Nest document did.
- **CORS** comes from `CORSMiddleware` with the single `WEB_ORIGIN`.

### CSV parsing with the standard library

`csv.reader` with `strict=True` over `io.StringIO(text, newline='')`, after decoding with `utf-8-sig`.

- Headers are trimmed and lower-cased, and unknown columns are dropped.
- Missing required columns are reported together.
- A row's line number is `reader.line_num` minus the newlines embedded in its cells. `line_num` is the last physical line of the record, the same quantity `csv-parse`'s `info.lines` gave.
- An empty line yields `[]`, which is a blank row and therefore `skipped`.
- An unterminated quote raises `csv.Error`, which becomes `InvalidImportFileError`.

The fixture test (87 created, 2 skipped, 8 failed) is the acceptance check for all of this.

### Composition root and dependency injection

`create_app(config)` builds the engine, the repositories and the use cases, and keeps them on `app.state`. Routers get them through small `Depends` providers. Tests call `create_app` with the test configuration and talk to it through `httpx.AsyncClient(transport=ASGITransport(app))`. Rejected: a DI container library, because one factory function is the whole graph.

### Tooling and the monorepo gate

- **Python and packaging:** Python 3.14 and uv, with `uv.lock` committed.
- **Lint and format:** Ruff, replacing ESLint and Prettier for this tree. `import-order` becomes Ruff's `I` rules.
- **Types:** mypy `--strict` with the Pydantic plugin.
- **Layers:** import-linter with a `layers` contract (`infra` > `application` > `domain`) and `forbidden` contracts that keep `fastapi`, `starlette`, `sqlalchemy`, `psycopg` and `alembic` out of `domain` and `application`, and `pydantic` out of `domain`.
- **No comments:** `scripts/check_sources.py` walks `src/`, `tests/` and `migrations/` with `tokenize`, rejecting `COMMENT` tokens, and with `ast`, rejecting docstrings. It prints `path:line`. Ruff has no rule that forbids every comment.
- **Tests:** pytest with pytest-asyncio. The session fixture drops and recreates `ecommerce_test`, then runs `alembic upgrade head`. Recreating it, rather than creating it only when it is missing, also covers a test database left behind by the Prisma setup. A per-test fixture truncates the five tables, the equivalent of `resetDatabase`. The markers `unit` and `integration` replace the Vitest projects.
- **Imports without `.pth` files:** pytest sets `pythonpath = ["src"]`, Alembic prepends `src`, and the `dev`, `start` and import-linter commands set `PYTHONPATH=src`. On macOS, iCloud-synced folders such as `~/Documents` can mark the editable-install `.pth` files hidden, and Python 3.14 skips hidden `.pth` files. The container is unaffected because it installs the package without editable mode.
- **Turbo:** `apps/api/package.json` keeps the task names, each running `uv run …`: `lint` runs ruff check, ruff format --check, lint-imports and the source check; `typecheck` runs mypy; `test` runs pytest; `dev` runs uvicorn with reload, and `db:migrate` runs `alembic upgrade head`. A root `pnpm db:migrate` wraps it with `dotenv -e .env`, because `pnpm --filter` does not load `.env`. Turbo and `pnpm check` need no special case. `db:generate` leaves `turbo.json`, and the API drops its `@ecommerce/shared` dependency.
- **Prettier and ESLint** ignore `apps/api`.
- **CI** adds `astral-sh/setup-uv` with Python 3.14 before `pnpm check`. CodeQL analyzes `python` alongside `javascript-typescript`. Dependabot adds the `uv` ecosystem for `/apps/api`.

Rejected: a separate Python gate outside `pnpm check`, because two commands mean one gets forgotten; and Poetry, which is slower and whose lockfile workflow is the less common choice in 2026.

### Container

`python:3.14-slim`. uv is copied from its official image, and a build stage runs `uv sync --locked --no-dev` into a virtualenv. The runtime stage copies the venv and the source and runs as an unprivileged `app` user. The command is `sh -c "alembic upgrade head && exec python -m ecommerce_api"`. The Compose healthcheck becomes a `python -c` `urllib` request to `/health`, since the slim image has no `wget`.

## Risks / Trade-offs

- [The Pydantic and zod copies of the rules drift] → The shared validation-case table runs in both test suites. The README states that a rule change means editing both schemas and the table.
- [Differences in CSV edge cases between `csv-parse` and `csv`, such as line numbers with embedded newlines, BOM handling and empty lines] → Port every `parse-csv` unit test and the fixture assertion as they are.
- [Float semantics for money] → Money is `Decimal` inside the domain and repositories, JSON numbers at the edge only. Totals are computed on `Decimal`, which keeps `3 × 19.99 = 59.97` without the cents trick.
- [Concurrency in reservation behaves differently on async psycopg] → The statement shape is unchanged (a conditional `UPDATE` per item, in `productId` order, one transaction). The concurrent-oversell integration test is ported with `asyncio.gather` over separate connections.
- [The web tests pass while the live API diverges, because the web tests stub `fetch`] → Final verification includes `docker compose up --build` and a manual pass over the two demo flows, plus a check of `/docs`.
- [The toolchain gets heavier: contributors need Python 3.14 and uv as well as Node and pnpm] → The README prerequisites list both. Docker remains enough to run the stack.
- [Existing development databases fail on the first `alembic upgrade`] → Documented once: `docker compose down -v`. It is a demo database with no data worth keeping.

## Migration Plan

1. On `feat/migrate-api-to-python`, build the Python package inside `apps/api` next to the TypeScript sources (`src/ecommerce_api`, `tests/`). The Nest tests stay runnable as the oracle until parity.
2. Port the tests layer by layer (domain, schemas, application, repositories, HTTP) and make each layer pass before the next.
3. Switch `apps/api/package.json`, Turbo, CI, Docker and Compose to Python. Delete the Nest sources, Prisma, the TypeScript tests and `api-env` from `packages/shared`.
4. Update the README and `CLAUDE.md`. Verify with `pnpm check`, `docker compose down -v && docker compose up --build`, the fixture import and a paid and a declined order.

Rollback: the change is one branch and one PR. Until merge, `main` keeps the Nest API. After merge, reverting the merge commit restores it, because the schema is identical in both.
