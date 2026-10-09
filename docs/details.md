# Details

## Roles

Roles are cumulative (admin ⊃ pharmacist ⊃ technician). Checked server-side in `roleCan` (`src/lib/orderService.ts`).

| Action | Technician | Pharmacist | Admin |
| --- | :-: | :-: | :-: |
| Create order, fill verified order | yes | yes | yes |
| Verify, cancel, complete order | no | yes | yes |
| View audit log | no | yes | yes |
| Adjust inventory stock | no | no | yes |

## Order states

`pending → verified → filled → completed`, plus `pending/verified → cancelled`. Anything else returns `INVALID_TRANSITION`.

## Design notes

- All writes go through REST route handlers (`src/app/api/`) → `orderService`. No server actions.
- `OrderServiceError` codes (`FORBIDDEN`, `INVALID_TRANSITION`, `INSUFFICIENT_STOCK`, `NOT_FOUND`, `INVALID_INPUT`) map to HTTP 403/409/404/400.
- Fill locks the order and medication rows (`FOR UPDATE`) so concurrent fills can't oversell stock.
- Auth: `POST /api/auth/login` checks bcrypt hash and sets an `authjs.session-token` JWT cookie signed with `AUTH_SECRET`. `src/proxy.ts` redirects unauthenticated page requests to `/login`; API routes return their own 401/403.
- `audit_logs.details` is jsonb (`from`, `to`, `quantity`, `stockBefore`, `stockAfter`, …).
- `/fhir` fetches `Patient` and `MedicationRequest` from https://hapi.fhir.org/baseR4 on the server only, cached 5 min, 8 s timeout; failures render a retry card.

## Tests

`npm test` migrates the test DB (`db-test`, port 5434) then runs Vitest against real Postgres. Suites: `tests/orderService.test.ts` (state machine, roles, transactions), `tests/api.test.ts` (route handlers), `tests/fhir.test.ts` (offline mapper tests).

## Limitations

Demo only: not HIPAA-compliant, no password reset/MFA, no clinical logic. Replace `AUTH_SECRET` and credentials auth before any real use.
