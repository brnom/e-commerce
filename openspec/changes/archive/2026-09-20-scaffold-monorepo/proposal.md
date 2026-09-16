# Proposal

## Why

We are starting an e-commerce platform (product catalog, search, purchasing) from an empty repository. Before any product feature can be built we need a foundation that every later change can rely on: a monorepo with an API, a web app and a shared package, a local database, one-command startup via Docker, and a quality gate that runs on every push. Doing this first keeps feature changes focused on behavior instead of tooling.

## What Changes

- Create a pnpm + Turborepo monorepo with three workspaces:
  - `apps/api` — NestJS REST API (TypeScript)
  - `apps/web` — Next.js App Router application, rendered client-side, talking to the API over HTTP
  - `packages/shared` — TypeScript types and zod schemas consumed by both apps
- Add PostgreSQL as the system of record, accessed through Prisma with migrations checked into the repo (no domain models yet; those arrive with the product catalog change).
- Add a `docker-compose.yml` that starts the database, the API and the web app with one command, applying pending migrations before the API accepts traffic.
- Expose an API health endpoint so orchestrators and humans can verify the stack is up.
- Add a repository-wide quality gate: linting, type-checking, formatting and unit tests, runnable locally and in CI (GitHub Actions).
- Enforce a "no source comments" lint rule across all workspaces so intent lives in names, types and docs rather than inline comments.
- Add a `README.md` skeleton with local run instructions.

## Capabilities

### New Capabilities

- `deployment`: how the platform is started, configured and health-checked as a set of containers; the runtime contract every environment (local, CI, production) must honor.

### Modified Capabilities

_None — this is the first change in the project._

## Impact

- New files: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `docker-compose.yml`, Dockerfiles for `api` and `web`, `.github/workflows/ci.yml`, ESLint/Prettier/TypeScript configs, `apps/api`, `apps/web`, `packages/shared`.
- New runtime dependencies: Node 24, pnpm, NestJS, Next.js, Prisma, PostgreSQL 16, zod.
- No existing code or data is affected.
- Later changes (`products-crud-search`, `csv-import`, `purchase`) depend on this scaffold and will extend the Prisma schema, the API modules and the web routes it establishes.
