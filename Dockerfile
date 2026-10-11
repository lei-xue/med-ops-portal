# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- build: full dependency tree, compile Next.js ----
FROM base AS build
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# ---- production dependencies only ----
# .npmrc is deliberately not copied: its include=dev would override --omit=dev.
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: no dev tooling, no sources beyond what boot needs ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --chown=node:node package.json next.config.ts tsconfig.json ./
# Migrations and the idempotent seed run at boot (scripts/start-prod.sh).
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src/db ./src/db

USER node
EXPOSE 3000
CMD ["sh", "/app/scripts/start-prod.sh"]
