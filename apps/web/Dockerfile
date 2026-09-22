FROM node:26-alpine AS base
RUN npm install --global pnpm@10.32.1
WORKDIR /repo

FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:5001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web...
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @ecommerce/shared build && pnpm --filter web build

FROM node:26-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ARG WEB_PORT=3005
ENV PORT=$WEB_PORT
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
RUN mkdir -p apps/web/.next/cache && chown -R node:node apps/web/.next
EXPOSE $WEB_PORT
USER node
CMD ["node", "apps/web/server.js"]
