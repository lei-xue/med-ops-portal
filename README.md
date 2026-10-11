# MedOps Portal

A pharmacy operations console: orders go from entry to pharmacist verification, fill and hand-off, alongside inventory tracking and a full audit trail. All data is fictional.

[![CI](https://github.com/lei-xue/med-ops-portal/actions/workflows/ci.yml/badge.svg)](https://github.com/lei-xue/med-ops-portal/actions/workflows/ci.yml)
&nbsp;**Live demo:** https://medops.leixue.dev

![Dashboard](docs/screenshots/dashboard.png)

<table>
  <tr>
    <td><a href="docs/screenshots/orders.png"><img src="docs/screenshots/orders.png" alt="Orders"></a></td>
    <td><a href="docs/screenshots/order-detail.png"><img src="docs/screenshots/order-detail.png" alt="Order detail"></a></td>
    <td><a href="docs/screenshots/inventory.png"><img src="docs/screenshots/inventory.png" alt="Inventory"></a></td>
  </tr>
  <tr>
    <td><a href="docs/screenshots/patient.png"><img src="docs/screenshots/patient.png" alt="Patient"></a></td>
    <td><a href="docs/screenshots/new-order.png"><img src="docs/screenshots/new-order.png" alt="New order"></a></td>
    <td><a href="docs/screenshots/audit-log.png"><img src="docs/screenshots/audit-log.png" alt="Audit log"></a></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/mobile-dashboard.png" alt="Dashboard on a phone" width="200">
  &nbsp;
  <img src="docs/screenshots/mobile-order.png" alt="Order on a phone" width="200">
</p>

Sign in as `tech@demo.local`, `pharmacist@demo.local` or `admin@demo.local`. The password for all three is `demo1234!`.

## Highlights

- Every order links to a patient, a prescriber and one product. Each of those has its own page listing its orders.
- The catalog has 42 products across 27 drugs, split by strength and dosage form, with Rx, OTC and DEA-schedule rules enforced on the server.
- Fills lock the order and stock rows. Race tests prove that simultaneous fills can't oversell stock.
- Every change writes its audit row in the same transaction, so the audit log can't drift from the data.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, PostgreSQL 16, Drizzle, Auth.js, Vitest. It's deployed with Docker behind a Cloudflare Tunnel.

## Run locally

```bash
npm install && cp .env.example .env
npm run db:up && npm run db:migrate && npm run db:seed
npm run dev    # http://localhost:3000
```

For architecture, the data model, deployment, testing and security notes, see [docs/details.md](docs/details.md).
