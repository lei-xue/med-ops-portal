#!/bin/sh
set -e

echo "[start-prod] running migrations..."
node scripts/migrate.cjs

echo "[start-prod] seeding (idempotent)..."
node scripts/seed.cjs || echo "[start-prod] seed skipped/failed (continuing)"

echo "[start-prod] starting Next.js..."
# exec so the server is PID 1 and receives SIGTERM from `docker stop`.
exec node server.js
