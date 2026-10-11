# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- build: compile Next.js (standalone) and bundle the boot scripts ----
FROM base AS build
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build && npm run build:scripts

# ---- runtime: the standalone server plus plain-JS boot scripts ----
# No npm install here: .next/standalone carries the few modules the server
# imports, and the migrate/seed scripts are self-contained esbuild bundles.
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    # Docker sets HOSTNAME to the container id; Next's standalone server
    # would bind only to that address.
    HOSTNAME=0.0.0.0 \
    # Keep the V8 heap well inside the compose mem_limit (384m).
    NODE_OPTIONS=--max-old-space-size=256
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/dist/scripts ./scripts
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node scripts/start-prod.sh ./scripts/start-prod.sh

USER node
EXPOSE 3000
CMD ["sh", "/app/scripts/start-prod.sh"]
