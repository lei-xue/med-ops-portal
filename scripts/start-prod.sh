#!/bin/sh
set -e

echo "[start-prod] running migrations..."
npx tsx scripts/migrate.ts

echo "[start-prod] seeding (idempotent)..."
npx tsx scripts/seed.ts || echo "[start-prod] seed skipped/failed (continuing)"

echo "[start-prod] starting Next.js..."
exec npm start
