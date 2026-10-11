# MedOps Portal

**A pharmacy operations console: prescriptions move from intake through pharmacist verification, fill and hand-off, with inventory and an audit trail that can't drift from the data.**

[![CI](https://github.com/lei-xue/med-ops-portal/actions/workflows/ci.yml/badge.svg)](https://github.com/lei-xue/med-ops-portal/actions/workflows/ci.yml)
&nbsp;**Live demo:** https://medops.leixue.dev

All patients, prescribers, NDCs and orders are fictional. There is no PHI.

![Dashboard](docs/screenshots/dashboard.png)

<p align="center">
  <img src="docs/screenshots/mobile-dashboard.png" alt="Dashboard on a phone" width="240">
  &nbsp;
  <img src="docs/screenshots/mobile-order.png" alt="Order detail on a phone" width="240">
</p>

## Try it

Every account uses the password `demo1234!`.

| Account | Role | Can |
| --- | --- | --- |
| `tech@demo.local` | Technician | Enter orders, fill verified orders |
| `pharmacist@demo.local` | Pharmacist | All of the above, plus verify, cancel and complete orders, and read the audit log |
| `admin@demo.local` | Admin | All of the above, plus adjust inventory |

A two-minute tour:

1. As the **technician**, open **New order**. Pick a prescription-only product without a prescriber and the server refuses it. Pick a Schedule II stimulant and refills lock at 0.
2. As the **pharmacist**, verify the order from the dashboard's work queue.
3. As the **technician**, fill it. Stock drops in the same transaction, and the order's history shows each step.
4. Click through: the order links to its patient (with allergies), its prescriber and its product, and each of those pages lists its own orders.

## What's inside

**Pharmacy domain**
- Patients (MRN, date of birth, allergies) and prescribers (NPI, specialty) are records in their own right, not names on an order.
- A catalog of 42 products across 27 drugs. Each product is one strength and dosage form, e.g. amoxicillin 250 mg capsule, 875 mg tablet and 400 mg/5 mL suspension, and is counted in its own unit: tablets, mL, inhalers, pens.
- Rx vs OTC and DEA schedules are enforced on the server. Prescription-only products need a prescriber. Schedule II can't be refilled. Schedule III–V allow at most 5 refills.
- Orders follow `pending → verified → filled → completed`, with cancellation allowed only before filling. Every role check happens on the server.

**Engineering choices worth a look**
- **Transactions you can test.** Filling locks the order and stock rows (`SELECT … FOR UPDATE`). Race tests fire eight simultaneous fills at stock that covers one, and they fail if the locks are removed.
- **An audit log that's always right.** Every write records its audit row in the same transaction. Failed sign-ins are audited too, written in the background so response timing doesn't reveal which accounts exist.
- **No silent overwrites.** Stock edits carry the level the admin saw. If a fill landed in between, the edit is refused (`409 STALE_STOCK`) and the form shows the new number.
- **Time zone-correct "today".** Day boundaries are computed in Postgres using the clinic's zone, not the server's UTC.
- **Hardened auth.** The app has a same-origin redirect check, rate limits per account, per address and across addresses, sessions that fail closed on an unknown role, and security headers.
- **A small production image.** Next.js standalone output plus esbuild-bundled boot scripts make a 311 MB image that idles around 45 MB of memory and runs under hard memory limits.

## Architecture

```mermaid
flowchart LR
  user[Browser] -->|HTTPS| cf[Cloudflare]
  cf -->|Tunnel| cfd[cloudflared]
  subgraph host [littlecreek · Docker]
    cfd --> app["Next.js app<br/>pages + /api routes"]
    app --> svc["orderService<br/>rules · roles · transactions"]
    svc --> db[("PostgreSQL 16")]
  end
  app -. read-only .-> fhir["HAPI FHIR R4<br/>public sandbox"]
```

Every write goes through a REST route handler and then `src/lib/orderService.ts`. There are no server actions, so the API tests exercise the same code path as the UI.

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, standalone output), React 19, TypeScript |
| UI | Tailwind CSS v4, IBM Plex Sans/Mono, Lucide icons |
| Data | PostgreSQL 16, Drizzle ORM and migrations, zod at the API boundary |
| Auth | Auth.js v5 to read sessions; a JSON login route mints the JWT cookie |
| Tests | Vitest against a real Postgres |
| Ops | Docker Compose, Cloudflare Tunnel, GitHub Actions |

```
src/app/            pages and /api route handlers
src/lib/            orderService (rules, transactions), queries, permissions, session, rate limiting
src/db/schema.ts    tables, enums and relations
drizzle/            SQL migrations
scripts/            migrate, seed and container start script
tests/              Vitest suites
```

## Tests

`npm test` runs 89 tests against a real Postgres. They cover:
- the state machine;
- the role matrix;
- prescription rules;
- transaction rollback;
- concurrency races;
- every API route's status codes;
- login hardening;
- proxy redirects;
- redirect sanitising;
- FHIR mapping.

CI runs lint, typecheck, the tests and a production build. It also builds the Docker image and boots it against Postgres until `/api/health` answers.

## Run locally

You need Docker and Node.js 22+.

```bash
npm install
cp .env.example .env
npm run db:up          # Postgres: dev on :5433, test on :5434
npm run db:migrate
npm run db:seed        # idempotent demo data
npm run dev            # http://localhost:3000
```

Tests need a `.env.test` with `DATABASE_URL=postgres://postgres:postgres@localhost:5434/medops_test`, then `npm test`. Other scripts: `build`, `start`, `lint`, `typecheck`, `db:migrate:test`.

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true` | `.env` | App |
| `CLINIC_TIME_ZONE` | `.env` (optional) | IANA zone for "today" and displayed times. Default `America/New_York` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `AUTH_SECRET`, `POSTGRES_DB` | `.env.prod` | Production; `POSTGRES_DB` is optional and defaults to `medops` |

## Deploy

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

- **Containers.** Postgres and the app. The app migrates and seeds at boot, runs as the unprivileged `node` user, and has a `/api/health` healthcheck.
- **Memory.** Capped at 384 MB for the app and 256 MB for Postgres.
- **Networking.** Nothing listens on a public port. The app joins the shared `edge` Docker network as `medops`, and a Cloudflare Tunnel carries traffic to it. TLS terminates at Cloudflare.
- **One-time setup.**
  - Run `docker network create edge` if it doesn't exist yet.
  - Add the public hostname `medops.leixue.dev → http://medops:3000` to the tunnel.
- **Secrets.** Generate them with `openssl rand -hex 32`. Hex output keeps the Postgres password URL-safe, which matters because compose builds `DATABASE_URL` from it.

## Security notes

**In place:**
- **Passwords.** bcrypt, with an equal-cost check for unknown emails and a single generic error message.
- **Login.** 429 responses with `Retry-After`. Failed attempts are audited with IP and user agent, never the password.
- **Client IP.** Read from `CF-Connecting-IP`, which Cloudflare overwrites. All traffic arrives through the tunnel.
- **Sessions.** HttpOnly, SameSite=Lax cookies, with the `__Secure-` prefix behind HTTPS.
- **Authorization.** Every API route checks session and role on the server, and every page redirects on its own as well as via the proxy.
- **Input.** zod at the boundary, a 16 KB cap on request bodies, parameterised queries, and search that escapes LIKE wildcards.

**Known trade-offs, deliberate for a demo:**
- **Session revocation.** Sessions are stateless JWTs valid for 7 days, so a role change takes effect when the token expires. A real deployment would shorten the lifetime and re-check the role, or keep a revocation list.
- **Rate limiter.** It lives in memory, per instance. Multiple replicas would need Redis or similar.
- **Trusted header.** `CF-Connecting-IP` is trusted because the origin has no public port. Only trusted services should share the `edge` network.
- **Audit immutability.** `audit_logs` is append-only by convention; the database role isn't yet barred from `UPDATE`/`DELETE`.
- **Demo accounts.** They're public, and there's no password reset or MFA.

<details><summary>More screenshots (from the live demo)</summary>

| | |
| --- | --- |
| ![Orders](docs/screenshots/orders.png) | ![Order detail](docs/screenshots/order-detail.png) |
| ![Patient](docs/screenshots/patient.png) | ![Prescriber](docs/screenshots/prescriber.png) |
| ![Inventory, controlled substances](docs/screenshots/inventory.png) | ![Medication detail](docs/screenshots/medication.png) |
| ![New order](docs/screenshots/new-order.png) | ![Audit log](docs/screenshots/audit-log.png) |
| ![Sign in](docs/screenshots/login.png) | ![FHIR feed](docs/screenshots/fhir-feed.png) |

</details>

Design notes, the role matrix, the data model and the prescription rules are in [docs/details.md](docs/details.md).
