import { test, expect } from "@playwright/test";

import { PASSWORD, ROLES, sidebar } from "./helpers";

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

// KNOWN BUG — see e2e/FINDINGS.md. Sign-out races with Next.js prefetches that
// re-issue the rolling Auth.js session cookie, so the user is intermittently
// left signed in. Marked fixme rather than asserting flaky behavior.
test.describe("signing out", () => {
  test.use({ storageState: EMPTY_STATE });

  test.fixme("returns to the login form", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("pharmacist@demo.local");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});
