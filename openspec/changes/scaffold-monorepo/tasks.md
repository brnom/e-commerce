# Tasks

## 1. Repository and workspace layout

- [x] 1.1 Initialize git, add `.gitignore` (node_modules, dist, .next, .env, coverage) and `.editorconfig`; verify `git status` shows only intended files
- [x] 1.2 Create root `package.json` (private, `packageManager: pnpm@10`, `engines.node >=24`), `pnpm-workspace.yaml` listing `apps/*` and `packages/*`, and `.npmrc`; verify `pnpm install` succeeds on the empty workspace set
- [x] 1.3 Add `turbo.json` with `build`, `dev`, `lint`, `typecheck`, `test`, `format:check` pipelines (`build` depends on `^build`, explicit `outputs` for `dist/**` and `.next/**`); verify `pnpm turbo run build --dry-run` lists the expected task graph once workspaces exist
- [x] 1.4 Add root `tsconfig.base.json` (strict, ES2022, `moduleResolution: bundler`) that each workspace extends; verify a workspace `tsc --noEmit` picks it up

## 2. Shared package

- [x] 2.1 Scaffold `packages/shared` with `package.json` (name `@ecommerce/shared`, `exports` pointing at `src/index.ts`), `tsconfig.json`, a `zod` dependency and an `env` schema module exporting `apiEnvSchema` (`DATABASE_URL`, `PORT` with default 3001); verify `pnpm --filter @ecommerce/shared typecheck` passes
- [x] 2.2 Add Vitest to `packages/shared` with one test asserting `apiEnvSchema` rejects a missing `DATABASE_URL` and names it in the error; verify `pnpm --filter @ecommerce/shared test` passes

## 3. API workspace (NestJS)

- [x] 3.1 Scaffold `apps/api` with NestJS 12 (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config`), `main.ts`, `app.module.ts`, `tsconfig.json` extending the base, and `nest-cli.json`; verify `pnpm --filter api build` produces `dist/main.js`
- [x] 3.2 Add a `ConfigModule` setup that validates `process.env` with `apiEnvSchema` from `@ecommerce/shared` at bootstrap and throws on failure; verify starting the API without `DATABASE_URL` exits non-zero with a message containing `DATABASE_URL`
- [x] 3.3 Add Prisma 7 (`prisma`, `@prisma/client`) with `prisma/schema.prisma` containing only `datasource` (postgresql, `env("DATABASE_URL")`) and `generator client`, plus a `PrismaModule`/`PrismaService` that connects on module init; verify `pnpm --filter api prisma generate` succeeds and `prisma migrate dev --name init` creates an empty migration against a local Postgres
- [x] 3.4 Add `@nestjs/terminus` and a `HealthModule` exposing `GET /health` with a Prisma `SELECT 1` indicator; verify `curl localhost:3001/health` returns `200 {"status":"ok",...}` with the database up and `503` with `status: "error"` when the database is stopped
- [x] 3.5 Add a `ZodValidationPipe` registered globally, so later modules can validate bodies with shared schemas; verify a unit test that passes an invalid payload receives a `400` with the zod issues in the response body
- [x] 3.6 Add Vitest with `unplugin-swc` for decorator metadata and an e2e-style test that boots `AppModule` with a mocked `PrismaService` and asserts `GET /health` returns `200`; verify `pnpm --filter api test` passes
- [x] 3.7 Enable CORS for `WEB_ORIGIN` (default `http://localhost:3000`) read through the env schema; verify a preflight request from that origin receives the expected `Access-Control-Allow-Origin` header
- [x] 3.8 Restructure `apps/api/src` into `domain/`, `application/ports/`, `infra/{config,persistence/prisma,http}` with `main.ts` + `app.module.ts` as the composition root; replace `@nestjs/config` with a `Config` port bound by factory; add `DomainValidationError`/`NotFoundError` and an exception filter mapping them to 400/404; verify `pnpm --filter api build`, `test` and `typecheck` still pass and `/health` behaves as in 3.4
- [x] 3.9 Enforce the layer rule in ESLint (`no-restricted-imports` per layer, tests exempt) and add `eslint-plugin-import` order rules; verify a temporary `import` of `infra/` from `application/` fails lint naming the file, then remove it
- [x] 3.10 Split Vitest into `unit` and `integration` projects; verify `pnpm --filter api test` runs both and `vitest run --project unit` runs only `src/**/*.test.ts`

## 4. Web workspace (Next.js)

- [x] 4.1 Scaffold `apps/web` with Next.js 16 App Router, TypeScript, `tsconfig.json` extending the base, and a placeholder home page; verify `pnpm --filter web build` succeeds
- [x] 4.2 Add `@tanstack/react-query` with a client-side `QueryClientProvider` in the root layout and an `apiClient` helper that reads `NEXT_PUBLIC_API_URL` and throws a typed error on non-2xx responses; verify a unit test that mocks `fetch` and asserts the base URL is prefixed to the request path
- [x] 4.3 Render the API health status on the home page using `useQuery` against `/health`; verify the page shows "API: ok" with the API running and "API: unreachable" with it stopped
- [x] 4.4 Add Vitest with `@testing-library/react` and `jsdom` and one component test for the health indicator; verify `pnpm --filter web test` passes

## 5. Quality gate

- [x] 5.1 Add root `eslint.config.mjs` (flat config, ESLint 10, `typescript-eslint`, `eslint-plugin-react-hooks` and `@next/eslint-plugin-next` scoped to `apps/web`), with a `lint` script in every workspace; verify `pnpm turbo run lint` passes on the scaffold
- [x] 5.2 Add `eslint-plugin-no-comments` as an error on `apps/*/src/**/*.{ts,tsx}` and `packages/*/src/**/*.ts`, excluding `*.config.*`; verify a temporary `// test` comment in `apps/api/src/main.ts` fails lint naming the file and line, then remove it
- [x] 5.3 Add Prettier with a root config and `format` / `format:check` scripts; verify `pnpm turbo run format:check` passes
- [x] 5.4 Add a root `check` script running `turbo run lint typecheck test format:check`; verify `pnpm check` passes from a clean install
- [x] 5.5 Add `.github/workflows/ci.yml` running `pnpm install --frozen-lockfile` and `pnpm check` on push and pull request with pnpm and Turborepo caching, plus a second job that builds both Docker images; verify the workflow file passes `actionlint` (or a manual YAML review if `actionlint` is unavailable)

## 6. Containers

- [x] 6.1 Write `apps/api/Dockerfile` (multi-stage: pnpm install with `--filter api...`, build, `pnpm deploy --filter api --prod` into `/prod/api`, then `node:24-alpine` runtime running `prisma migrate deploy && node dist/main.js`); verify `docker build -f apps/api/Dockerfile .` succeeds and the image runs with a `DATABASE_URL` pointing at a local Postgres
- [x] 6.2 Write `apps/web/Dockerfile` (multi-stage with Next.js `output: "standalone"`, `NEXT_PUBLIC_API_URL` passed as a build arg); verify `docker build -f apps/web/Dockerfile .` succeeds and the container serves the home page on port 3000
- [x] 6.3 Write `docker-compose.yml` with `db` (`postgres:16-alpine`, `pg_isready` healthcheck, named volume `pgdata`), `api` (`depends_on: db: condition: service_healthy`, ports `3001:3001`), and `web` (ports `3000:3000`), plus a root `.env.example`; verify `docker compose up --build` from a clean clone reaches a state where http://localhost:3000 shows "API: ok"
- [x] 6.4 Verify migrate-then-serve: with an empty `pgdata` volume, `docker compose up` applies the init migration before the API logs "listening" (check container logs order); then simulate a failing migration locally and confirm the API container exits non-zero
- [x] 6.5 Verify persistence: create a row via `psql` in the running `db` container, `docker compose down` (without `-v`), `docker compose up`, and confirm the row still exists

## 7. Documentation

- [x] 7.1 Write `README.md` with: what the platform is, prerequisites, "run with Docker" (`docker compose up`), "run for development" (`pnpm install`, `docker compose up db`, `pnpm dev`), the quality gate (`pnpm check`), environment variables table, and a repository layout section; verify a fresh reader can follow it end to end by re-running the Docker path from a clean clone
- [x] 7.2 Run `pnpm check` and `docker compose up --build` one final time on the completed scaffold; verify both succeed with no comments in source files (`pnpm turbo run lint` is green)
