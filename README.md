# MedOps Portal

Demo internal workflow system for a pharmacy/clinic team: medication order lifecycle, inventory control and a full audit trail. All data is fictional (no PHI).

Live demo: https://medops.leixue.dev — logins `tech@demo.local`, `pharmacist@demo.local`, `admin@demo.local`, password `demo1234!`

![Dashboard](docs/screenshots/dashboard.png)

- Orders move `pending → verified → filled → completed` (cancel only while pending/verified); illegal transitions are rejected server-side
- Role checks (technician / pharmacist / admin) enforced in `src/lib/orderService.ts`
- Every mutation writes an `audit_logs` row in the same transaction; filling decrements stock atomically
- Read-only `/fhir` page pulling synthetic data from the public HAPI R4 sandbox

Tech: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, PostgreSQL 16, Drizzle ORM, Auth.js v5, Vitest

## Run locally

Needs Docker and Node.js 20+.

```bash
npm install
cp .env.example .env
npm run db:up          # Postgres dev :5433, test :5434
npm run db:migrate
npm run db:seed        # idempotent demo data
npm run dev            # http://localhost:3000
npm test               # needs .env.test with DATABASE_URL=postgres://postgres:postgres@localhost:5434/medops_test
```

Other scripts: `build`, `start`, `lint`, `typecheck`, `db:migrate:test`.

## Env vars

- `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true` — app (`.env`)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `AUTH_SECRET`, optional `POSTGRES_DB` (default `medops`) — production (`.env.prod`)

## Deploy

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Runs Postgres, the app (migrates + seeds at boot) and Caddy (automatic HTTPS; domain set in `Caddyfile`). Only ports 80/443 are public. Generate secrets with `openssl rand -hex 32`.

More: [docs/details.md](docs/details.md) (roles, state machine, design notes).
