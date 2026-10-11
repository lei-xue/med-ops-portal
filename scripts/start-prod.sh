#!/bin/sh
set -e

echo "[start-prod] running migrations..."
npx tsx scripts/migrate.ts

echo "[start-prod] seeding (idempotent)..."
npx tsx scripts/seed.ts || echo "[start-prod] seed skipped/failed (continuing)"

echo "[start-prod] starting Next.js..."
# Run Next directly (not via npm) so it receives SIGTERM from `docker stop`
# and can finish in-flight requests before exiting.
exec node node_modules/next/dist/bin/next start
