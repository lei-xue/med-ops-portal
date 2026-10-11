# E2E findings

Real application bugs found while writing the Playwright suite. They are **not**
fixed here (the suite only covers `e2e/`); the affected assertions are marked
with `test.fixme` and reference the entry below.

## 1. Sign-out is unreliable — the user is sometimes left signed in

- **Where:** `src/components/LogoutButton.tsx` (POST `/api/auth/logout` → `router.push("/login")`).
- **Covered by:** `e2e/auth.spec.ts` › `signing out` (marked `test.fixme`).
- **Steps:**
  1. Sign in with any seeded account, e.g. `tech@demo.local` / `demo1234!`.
  2. Click **Sign out** in the sidebar.
  3. Wait for navigation.
- **Expected:** the session cookie (`authjs.session-token`) is cleared and the
  browser lands on `/login` showing the sign-in form.
- **Actual:** intermittently (~1 in 2 runs) the user stays on the dashboard at
  `/` and the session cookie is still present and valid; a reload keeps them
  signed in. Observed for all three roles.
- **Notes:** even calling `POST /api/auth/logout` directly with `fetch` (no
  client navigation) leaves the cookie behind on some runs, then the next
  request re-issues it. The logout response always contains
  `authjs.session-token=; Path=/; Max-Age=0; HttpOnly; SameSite=lax`, but a
  concurrent Next.js prefetch/RSC request re-runs Auth.js (rolling JWT session)
  and writes a fresh cookie, undoing the clear. Reproduced headless with a
  minimal script (login → fetch logout → read `context.cookies()`).
