# Design

## Context

Empty repository. Local toolchain: Node 24, pnpm 10, Docker 29 with Compose v5. Current stable releases at the time of writing: NestJS 12, Next.js 16, Prisma 7 (8 is still a release candidate), Turborepo 2, ESLint 10. See proposal.md for motivation.

Three later changes will build on this scaffold: product catalog (CRUD + search), CSV import and purchasing. Each adds Prisma models, a NestJS module, and Next.js routes. The scaffold must make those additions mechanical: one new folder per module, one migration per schema change, no touching of tooling.

## Goals / Non-Goals

**Goals:**

- `git clone && docker compose up` yields a working, empty platform.
- `pnpm install && pnpm dev` yields the same stack for local development with hot reload (database still in Docker).
- One shared TypeScript source of truth for DTOs and validation, consumed by both API and web.
- One quality gate (`pnpm check`) that CI and developers run identically.
- Every workspace has at least one passing unit test so later changes extend a working test setup instead of creating one.

**Non-Goals:**

- Production hardening (TLS, secrets management, horizontal scaling, observability stack). The compose file is a local/CI runtime, not a production deployment.
- Authentication or multi-tenancy.
- Any domain model, endpoint or page beyond `/health` and a placeholder home page.
- End-to-end browser tests; unit tests only in this change.

## Decisions

### D1. Monorepo: pnpm workspaces + Turborepo

pnpm gives strict, fast installs and first-class workspaces; Turborepo adds task orchestration (`build`, `lint`, `test`) with dependency-aware ordering and caching so `packages/shared` builds before the apps that import it.

Alternatives: **Nx** — more features (generators, graph, affected) than a three-workspace repo needs, and a heavier learning surface for reviewers. **npm/yarn workspaces without an orchestrator** — task ordering across workspaces becomes hand-written scripts.

### D2. Architecture: separate API and web app, API is the only owner of the database

`apps/api` (NestJS) owns all persistence and business rules. `apps/web` (Next.js) is a client-side rendered application that talks to the API over HTTP using a single `NEXT_PUBLIC_API_URL`. Next.js server-side data fetching is deliberately not used, so there is exactly one API URL (the browser-facing one) and no split between "URL inside the Docker network" and "URL from the browser".

Alternatives: **Next.js full-stack (route handlers + Prisma in the web app)** — one deployable, but couples UI and domain logic and makes the API unusable by anything except this UI. **Server Components fetching from the API** — better first paint, but requires two API base URLs (`http://api:3001` from the container, `http://localhost:3001` from the browser) and introduces caching semantics that add nothing for an admin-style catalog UI.

### D3. Data: PostgreSQL 16 + Prisma 7

PostgreSQL for transactional guarantees needed later by purchasing (row-level `UPDATE ... WHERE stock >= qty`) and for `pg_trgm` search. Prisma for schema-as-code, generated types and a migration history that runs the same way locally, in CI and in the container (`prisma migrate deploy`). Pin to Prisma 7.x; 8 is a release candidate.

Alternatives: **TypeORM** — the NestJS default, but decorator-based entities drift from the database more easily and migrations are less ergonomic. **Drizzle** — lighter and SQL-first, but the migration story and Nest integration are less established. **SQLite** — simpler locally, but would rule out the concurrency semantics and text-search extensions the later changes rely on.

### D4. Shared validation: zod schemas in `packages/shared`

Zod schemas are the canonical definition of every DTO. The API validates request bodies with a small `ZodValidationPipe`; the web app derives form validation from the same schema (react-hook-form + `@hookform/resolvers/zod`). Types are inferred with `z.infer`, so there is one definition, not a class in the API and an interface in the web app.

Alternatives: **class-validator + class-transformer** (Nest default) — decorators on classes cannot be consumed by the browser without shipping reflection metadata, so the web app would need a second copy of every rule. **OpenAPI-generated client** — good for large teams, but adds a codegen step for three workspaces maintained by one team.

### D5. Runtime: Docker Compose with three services and a migrate-then-serve entrypoint

```
docker compose up
  db   postgres:16-alpine   healthcheck: pg_isready     volume: pgdata
  api  apps/api/Dockerfile  depends_on: db (healthy)    cmd: prisma migrate deploy && node dist/main.js
  web  apps/web/Dockerfile  depends_on: api             env: NEXT_PUBLIC_API_URL=http://localhost:3001
```

Both Dockerfiles are multi-stage: install with pnpm (`--filter` to the target workspace plus `packages/shared`), build, then copy only the production output into a slim `node:24-alpine` runtime image. Migrations run in the API entrypoint rather than a separate one-shot service so a fresh `up` on an empty volume needs no extra step, and a failed migration stops the API from serving.

Alternatives: **separate `migrate` service** — cleaner separation but adds a fourth service and an ordering dependency to explain. **Migrations at build time** — impossible; the database does not exist during image build.

### D6. Health endpoint: `@nestjs/terminus` with a Prisma ping

`GET /health` uses Terminus with a custom indicator that runs `SELECT 1` through Prisma. Returns `200 {"status":"ok"}` or `503 {"status":"error"}`. Compose does not gate `web` on this endpoint (the web app is static-ish and fails gracefully when the API is down), but it is the hook a real orchestrator would use.

### D7. Configuration: a `Config` port filled from a zod-validated environment

Environment variables are parsed once at bootstrap through the shared zod schema (`DATABASE_URL`, `PORT`, `WEB_ORIGIN`) into a plain `Config` object that the rest of the API receives through a port (see D10). A missing or malformed variable throws before the HTTP server starts, which satisfies the "exits with a non-zero status naming the variable" requirement. A single root `.env.example` documents every variable for both apps and compose.

Alternative: **`@nestjs/config`** — validates at module import time, which makes the environment a hidden dependency of every test that touches the module graph, and exposes configuration through a framework class rather than a port.

### D8. Quality gate: ESLint 10 flat config, Prettier, `tsc --noEmit`, Vitest

- ESLint flat config at the root, extended per workspace (`typescript-eslint`, `eslint-plugin-react-hooks` for web, `@next/eslint-plugin-next`).
- **No source comments**: enforced with `eslint-plugin-no-comments` on `**/*.ts, **/*.tsx` under `apps/*/src` and `packages/*/src`. Configuration files (`*.config.*`, `eslint.config.*`) are excluded so tool directives remain possible. This is a lint error, not a warning, so CI fails on any comment.
- Vitest in all three workspaces (faster than Jest, native ESM/TS; NestJS works with it via `unplugin-swc` for decorator metadata).
- `pnpm check` at the root runs `turbo run lint typecheck test format:check`; `.github/workflows/ci.yml` runs exactly that on push and pull request, with pnpm cache.

Alternatives for the comment rule: **grep in CI** — simple, but no editor feedback and easy to get wrong around URLs and regex literals; the ESLint plugin understands the AST.

### D9. Placeholder Prisma schema

`schema.prisma` ships with only `datasource` and `generator` blocks and an empty initial migration folder. The first real migration arrives with the product catalog change. This keeps the scaffold free of domain assumptions while still exercising the full migrate-on-start path.

### D10. API layout: hexagonal (ports and adapters), with NestJS confined to `infra/`

```
apps/api/src/
  main.ts            bootstrap; with app.module.ts, the composition root
  app.module.ts      the only module outside infra/ that imports infra/*
  domain/            entities, value objects, domain errors; no framework imports
  application/       ports (interfaces + injection tokens) and use cases; imports domain only
  infra/    NestJS modules, controllers, pipes, filters, Prisma adapters, env config
```

The dependency rule points inward: `domain` imports nothing from the other layers, `application` imports `domain` only, `infra` may import both, and only the composition root imports `infra`. The rule is enforced with ESLint `no-restricted-imports` blocks scoped per layer, so a violation fails `pnpm lint` rather than waiting for code review. Tests are exempt.

Ports are TypeScript interfaces paired with a `Symbol` injection token (for example `Config` + `CONFIG`); Nest modules in `infra/` bind each token to its adapter (`{ provide: CONFIG, useFactory: ... }`). Use cases receive ports through constructor parameters and carry no Nest decorators, so they are constructed directly in unit tests with in-memory fakes. Configuration is a port too: `infra/config/env-config.ts` parses the environment with the shared zod schema into a `Config` object, and `@nestjs/config` is not used.

Imports across layers use the `@/` alias (`@/application/ports/config`) rather than `../../` chains, declared once in `tsconfig.json` `paths`. Because `tsc` does not rewrite path aliases in emitted JavaScript, the API is compiled with the Nest CLI's SWC builder (`.swcrc` carries the same `paths`, and `typeCheck: true` keeps `tsc --noEmit` in the loop); SWC is already the transformer Vitest uses for decorator metadata, so build, dev and test share one compiler. Alternatives: `tsc-alias` as a post-build step (does not cover `nest start --watch`), `tsconfig-paths/register` at runtime (resolution cost in production), Node subpath imports (`#/` prefix, paths point at `dist/`).

Import order follows three blocks separated by blank lines — external, then project, then `import type` — enforced with `eslint-plugin-import`. Vitest runs two projects: `unit` (`src/**/*.test.ts`, fakes only) and `integration` (`test/**/*.test.ts`, boots the Nest application).

Alternatives: **Nest's conventional feature-module layout** (`products/products.service.ts` with Prisma injected directly) — less ceremony, but business rules end up decorated and coupled to both Nest and Prisma, and unit tests need the DI container. **Fastify with hand-written wiring** — the pattern this layout is adapted from; Nest was kept because it was already chosen (D2) and its module system does the wiring the composition root would otherwise do by hand.

## Risks / Trade-offs

- [Next.js 16 and NestJS 12 are recent majors; ecosystem plugins may lag] → Pin exact versions in `package.json`; prefer official plugins (`@next/eslint-plugin-next`, `@nestjs/terminus`, `@nestjs/config`).
- [Client-side rendering means an empty first paint until data loads] → Acceptable for an admin-style catalog UI; revisit with Server Components only if SEO becomes a goal.
- [Multi-stage Docker builds with pnpm workspaces are easy to get wrong (missing `packages/shared` in the runtime image)] → Use `pnpm deploy --filter <app> --prod` in the build stage to produce a self-contained folder, then copy that folder into the runtime stage; verify with a CI job that builds both images.
- [`eslint-plugin-no-comments` is a small community plugin] → It is a trivial rule (walks `sourceCode.getAllComments()`); if it breaks on ESLint 10, replace it with a ten-line local rule in `eslint.config.mjs`.
- [Hexagonal layering adds files and indirection for a small API] → The layer rule is mechanical and lint-enforced; each later change adds one use case, one port method and one adapter method, which keeps the cost predictable. Keeping Nest out of `domain/` and `application/` is what makes those layers testable without the container.
- [Vitest with NestJS requires SWC for decorator metadata] → Known configuration (`unplugin-swc` + `vitest.config.ts`); include a smoke test that instantiates a Nest module to prove it works.
- [Turborepo cache can hide a broken `packages/shared` build if inputs are misdeclared] → Declare `outputs` and `inputs` explicitly in `turbo.json`; CI runs with `--force` once a week is unnecessary, but the first CI run is uncached by construction.

## Migration Plan

Greenfield; nothing to migrate. Rollback is deleting the change. Later changes are expected to add a Prisma migration each and never edit an applied one.

## Open Questions

- Whether to enable `pg_trgm` in the initial migration or in the search change. Deferred to the `products-crud-search` change; it does not affect this scaffold.
