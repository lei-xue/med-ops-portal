# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Next.js build (needs devDeps for drizzle/tsx at runtime anyway, keep one stage simple)
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# ---- runtime ----
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000

# Entrypoint runs migrations + seed (idempotent), then starts Next
COPY scripts/start-prod.sh /app/scripts/start-prod.sh
RUN chmod +x /app/scripts/start-prod.sh
CMD ["/app/scripts/start-prod.sh"]
