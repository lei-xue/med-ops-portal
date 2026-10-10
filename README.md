# MedOps Portal

Demo internal workflow system for a pharmacy/clinic team: medication order lifecycle, inventory control and a full audit trail. All data is fictional (no PHI).

Live demo: https://medops.leixue.dev — logins `tech@demo.local`, `pharmacist@demo.local`, `admin@demo.local`, password `demo1234!`

![Dashboard](docs/screenshots/dashboard.png)

<details><summary>More screenshots</summary>

| | |
| --- | --- |
| ![Orders](docs/screenshots/orders.png) | ![Inventory](docs/screenshots/inventory.png) |
| ![Audit log](docs/screenshots/audit-log.png) | ![New order](docs/screenshots/new-order.png) |
| ![Sign in](docs/screenshots/login.png) | ![FHIR feed](docs/screenshots/fhir-feed.png) |

</details>

- Orders move `pending → verified → filled → completed` (cancel only while pending/verified); illegal transitions are rejected server-side
- Role checks (technician / pharmacist / admin) enforced in `src/lib/orderService.ts`
- Every mutation writes an `audit_logs` row in the same transaction; filling locks the order and stock rows, and race tests prove two simultaneous fills can't oversell
- Read-only `/fhir` page pulling synthetic data from the public HAPI R4 sandbox

UI: clinical-console layout — navy sidebar, IBM Plex Sans/Mono, one medical blue for primary actions, muted semantic colours for order status and stock levels, Lucide icons. The dashboard is a role-aware work queue built around the order pipeline.

Tech: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, PostgreSQL 16, Drizzle ORM, Auth.js v5, Vitest

## Run locally

Needs Docker and Node.js 22+.

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
- `CLINIC_TIME_ZONE` — optional IANA zone for "today" and displayed times (default `America/New_York`)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `AUTH_SECRET`, optional `POSTGRES_DB` (default `medops`) — production (`.env.prod`)

## Deploy

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Runs Postgres, the app (migrates + seeds at boot, as the unprivileged `node` user) and Caddy (automatic HTTPS, HSTS; domain set in `Caddyfile`). Caddy waits for the app's `/api/health` check. Only ports 80/443 are public. Generate secrets with `openssl rand -hex 32`.

## Security notes

What is in place:

- Passwords: bcrypt, constant-time rejection of unknown emails, one generic error message
- Login: rate limited per account and per address (429 with `Retry-After`); failed attempts on real accounts are audited with IP and user agent, never the password
- Sessions: HttpOnly, SameSite=Lax cookies, `__Secure-` prefixed behind HTTPS; tokens with an unknown role are treated as signed out
- Authorization: every API route checks the session and role on the server; every page redirects to `/login` on its own, not only via the proxy
- Redirects: `callbackUrl` is resolved and must stay same-origin (`//host`, `/\host` and similar are rejected)
- Headers: `nosniff`, framing denied, strict referrer policy, `noindex`, HSTS at the edge
- Input: zod validation at the API boundary, JSON bodies capped at 16 KB, Drizzle parameterised queries throughout
- Inventory edits carry the stock level the admin saw; if it changed meanwhile the edit is refused instead of overwriting a fill

Known trade-offs (deliberate for a demo):

- Sessions are stateless JWTs valid for 7 days. Deactivating a user or changing a role takes effect when the token expires; a real deployment would shorten the lifetime and re-check the role against the database, or keep a revocation list.
- The login rate limiter is in memory, so it is per instance and resets on restart. More than one replica would need a shared store such as Redis.
- Client IPs come from `CF-Connecting-IP` / `X-Forwarded-For`, which are trustworthy only because the app is reachable solely through Caddy behind Cloudflare.
- `audit_logs` is append-only by convention in the application; the database role is not yet restricted from `UPDATE`/`DELETE` on it.
- Demo accounts and their shared password are public on purpose. There is no password reset, MFA or account lockout.

More: [docs/details.md](docs/details.md) (roles, state machine, design notes).
