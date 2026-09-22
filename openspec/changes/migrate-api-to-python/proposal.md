# Proposal

## Why

The backend has to be written in one of Java, Clojure, Python, PHP or Go, and today it is NestJS on Node. Python is the closest fit for the current design: Pydantic does the job zod does now, FastAPI's routers and dependencies take over from Nest's controllers and modules, and `typing.Protocol` gives the ports the hexagonal layout already uses. The rewrite can therefore change the language without changing what the system does. The web app, the database schema and every scenario in `openspec/specs/` stay as they are.

## What Changes

- **BREAKING (implementation only)**: `apps/api` is rewritten in Python 3.14 with FastAPI, Pydantic v2, SQLAlchemy 2 (Core, async) on psycopg 3, Alembic and pytest. The NestJS application, Prisma, and their TypeScript tests are removed once the Python API passes the same scenarios.
- The HTTP contract `apps/web` consumes stays the same:
  - paths, methods and status codes;
  - camelCase JSON bodies, prices as JSON numbers and timestamps as ISO 8601 UTC strings;
  - the error body shapes for `400` (`{ message, issues: [{ path, message }] }`), `404`, `409` (SKU conflict and unavailable items), the `400` for an invalid import file, and `413`;
  - the `/health` report, and Swagger UI at `/docs` with the document at `/docs/json`.
- The validation rules and their messages move from `packages/shared` into Pydantic models in the API. The web app keeps using the zod schemas. A table of validation cases shared by both test suites stops the two copies from drifting apart.
- The PostgreSQL schema does not change. The four existing migrations are carried over verbatim as Alembic revisions and are still applied at container start, before the API serves.
- The layer boundaries (`domain` ← `application` ← `infra`) are enforced with import-linter. Ruff (lint and format) and mypy in strict mode take over from ESLint, Prettier and `tsc` for the API. A tokenize-based check keeps the "no comments in source" rule for Python.
- `pnpm check` stays the single quality gate: `apps/api/package.json` becomes a thin wrapper around `uv run` so Turborepo still runs lint, typecheck and test for the API. CI installs Python and uv. The API Docker image moves to `python:3.14-slim`, and the Compose healthcheck no longer depends on `wget`.
- `apiEnvSchema` and `parseApiEnv` are removed from `packages/shared` because the web app never used them. The API validates its environment with a small Pydantic model.
- The README (stack, prerequisites, commands, layout, decisions, security notes and status), `CLAUDE.md`, Dependabot (the `uv` ecosystem) and CodeQL (the `python` language) are updated.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deployment`: the "Quality gate on every push" requirement covers the Python API's lint, type check, formatting and tests, and its no-comments scenario applies to Python sources as well as TypeScript.

## Impact

- **Code**: `apps/api` is replaced entirely. `packages/shared` loses `env/api-env.ts`. `apps/web` is unchanged; its tests are the first check that the contract held.
- **Tooling**: root `turbo.json` (the `db:generate` task goes away), `.github/workflows/ci.yml` (setup-python and setup-uv, integration tests on the existing Postgres service), `.github/workflows/codeql.yml`, `.github/dependabot.yml`, `apps/api/Dockerfile`, `docker-compose.yml` (healthcheck command), `.prettierignore` or ESLint ignores for the Python tree.
- **Data**: no schema change. A development database already migrated by Prisma carries a `_prisma_migrations` table and no `alembic_version` row, so it has to be recreated once (`docker compose down -v`). The README says so.
- **Dependencies**: all Node dependencies of the API go away. Python dependencies are managed by uv with a committed `uv.lock`.
- **Risk**: the Python models must produce the same validation outcomes as the zod schemas. The main traps are Pydantic's lax coercion, which turns `"29.99"` into a number where zod rejects the string, and messages that differ from zod's. Mitigated by strict number fields, custom messages, and the shared case table.
