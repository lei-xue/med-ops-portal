import { test, expect } from "@playwright/test";

import { PASSWORD, ROLES, authFile, sidebar } from "./helpers";

const EMPTY_STATE = { cookies: [], origins: [] };

test.describe("unauthenticated access", () => {
  test.use({ storageState: EMPTY_STATE });

  test("a protected page redirects to the login form", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });
});

test.describe("bad credentials", () => {
  test.use({ storageState: EMPTY_STATE });

  test("a wrong password keeps the user on the login form", async ({ page }) => {
    await page.goto("/login");
    // A non-existent account, so the failed attempt doesn't burn a real
    // account's rate-limit budget.
    await page.getByLabel("Email").fill("ghost@demo.local");
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

for (const role of ROLES) {
  test.describe(`signing in as the ${role.label}`, () => {
    test.use({ storageState: EMPTY_STATE });

    test("shows the user's name and role in the sidebar", async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(role.email);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page).toHaveURL(/\/$/);
      await expect(sidebar(page).getByText(role.name)).toBeVisible();
      await expect(
        sidebar(page).getByText(role.label, { exact: true }),
      ).toBeVisible();
    });
  });
}

// Signing out right after a page loads used to race with prefetch requests that
// re-issued the session cookie (see e2e/FINDINGS.md), so click as early as
// possible and check the cookie and a later visit, not just the redirect.
// Reuses a saved session: the login rate limit allows 5 sign-ins per account.
test.describe("signing out", () => {
  test.use({ storageState: authFile("technician") });

  test("returns to the login form and stays signed out", async ({ page, context }) => {
    await page.goto("/", { waitUntil: "commit" });
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();

    const hasSession = async () =>
      (await context.cookies()).some((cookie) => cookie.name.includes("session-token"));
    await expect.poll(hasSession).toBe(false);
    // Give late prefetch responses time to land, then check again.
    await page.waitForTimeout(2000);
    expect(await hasSession()).toBe(false);
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
  });
});
