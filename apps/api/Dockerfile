FROM node:26-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @ecommerce/shared build \
 && pnpm --filter api db:generate \
 && pnpm --filter api build \
 && pnpm --filter api deploy --prod --legacy /prod/api

FROM node:26-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod/api ./
ARG API_PORT=5001
EXPOSE $API_PORT
USER node
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
