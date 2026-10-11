# MedOps Portal

Demo internal workflow system for a pharmacy/clinic team: prescriptions linked to patients and prescribers, a product catalog with strengths, dosage forms and Rx/OTC/controlled status, inventory control and a full audit trail. All data is fictional (no PHI).

Live demo: https://medops.leixue.dev — logins `tech@demo.local`, `pharmacist@demo.local`, `admin@demo.local`, password `demo1234!`

![Dashboard](docs/screenshots/dashboard.png)

<p align="center">
  <img src="docs/screenshots/mobile-dashboard.png" alt="Dashboard on a phone" width="240">
  &nbsp;
  <img src="docs/screenshots/mobile-order.png" alt="Order detail on a phone" width="240">
</p>

<details><summary>More screenshots (taken from the live demo)</summary>

| | |
| --- | --- |
| ![Orders](docs/screenshots/orders.png) | ![Order detail](docs/screenshots/order-detail.png) |
| ![Patient](docs/screenshots/patient.png) | ![Prescriber](docs/screenshots/prescriber.png) |
| ![Inventory, controlled substances](docs/screenshots/inventory.png) | ![Medication detail](docs/screenshots/medication.png) |
| ![New order](docs/screenshots/new-order.png) | ![Audit log](docs/screenshots/audit-log.png) |
| ![Sign in](docs/screenshots/login.png) | ![FHIR feed](docs/screenshots/fhir-feed.png) |

</details>

- Every order links to a patient record (MRN, date of birth, allergies), a prescriber (NPI, specialty) and one product; each has its own page listing its orders
- Catalog of 42 products across 27 drugs: one product per strength and dosage form (e.g. amoxicillin 250 mg capsule, 875 mg tablet, 400 mg/5 mL suspension), counted in its own unit (tablets, mL, inhalers, pens…)
- Prescription rules enforced server-side: Rx-only products need a prescriber, OTC products don't; Schedule II controlled substances can't be refilled, Schedule III–V allow at most 5 refills
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

Runs Postgres and the app (migrates + seeds at boot, as the unprivileged `node` user, with a `/api/health` healthcheck). The image ships Next.js's standalone server and esbuild-bundled migrate/seed scripts, with no `node_modules` install (about 310 MB). Memory is capped at 384 MB for the app and 256 MB for Postgres; the app idles around 45 MB and peaked under 80 MB in a load test. Nothing listens on a public port: the app joins the shared `edge` Docker network as `medops`, and a Cloudflare Tunnel (`cloudflared` in `/opt/edge`) carries traffic to it. One-time setup: `docker network create edge` if it doesn't exist, then add the public hostname `medops.leixue.dev → http://medops:3000` to the tunnel in Zero Trust → Networks → Tunnels. TLS terminates at Cloudflare. Generate secrets with `openssl rand -hex 32` (hex keeps the Postgres password URL-safe, which matters because compose builds `DATABASE_URL` from it).

## Security notes

What is in place:

- Passwords: bcrypt, constant-time rejection of unknown emails, one generic error message
- Login: rate limited per account, per address and per account across addresses (429 with `Retry-After`); failed attempts on real accounts are audited with IP and user agent, never the password
- Client IP: taken from `CF-Connecting-IP`, which Cloudflare overwrites with the real address; all traffic arrives through the tunnel
- Sessions: HttpOnly, SameSite=Lax cookies, `__Secure-` prefixed behind HTTPS; tokens with an unknown role are treated as signed out
- Authorization: every API route checks the session and role on the server; every page redirects to `/login` on its own, not only via the proxy
- Redirects: `callbackUrl` is resolved and must stay same-origin (`//host`, `/\host` and similar are rejected)
- Headers: HSTS, `nosniff`, framing denied, strict referrer policy, `noindex`
- Input: zod validation at the API boundary, JSON bodies capped at 16 KB, Drizzle parameterised queries throughout
- Inventory edits carry the stock level the admin saw; if it changed meanwhile the edit is refused instead of overwriting a fill

Known trade-offs (deliberate for a demo):

- Sessions are stateless JWTs valid for 7 days. Deactivating a user or changing a role takes effect when the token expires; a real deployment would shorten the lifetime and re-check the role against the database, or keep a revocation list.
- The login rate limiter is in memory, so it is per instance and resets on restart. More than one replica would need a shared store such as Redis.
- `CF-Connecting-IP` is trusted because the origin has no public port. Other containers on the shared `edge` network could reach `medops:3000` directly and set it, so only trusted services should join that network.
- `audit_logs` is append-only by convention in the application; the database role is not yet restricted from `UPDATE`/`DELETE` on it.
- Demo accounts and their shared password are public on purpose. There is no password reset, MFA or account lockout.

More: [docs/details.md](docs/details.md) (roles, state machine, design notes).
