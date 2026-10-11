import { test as setup, expect } from "@playwright/test";

import { PASSWORD, ROLES, authFile, sidebar, signIn } from "./helpers";

// Log each role in once, through the real form, and persist the session cookie.
// Specs then reuse the stored state instead of hitting the (rate-limited) login
// endpoint again.
for (const role of ROLES) {
  setup(`authenticate as ${role.label}`, async ({ page }) => {
    await signIn(page, role.email, PASSWORD);
    await expect(page).toHaveURL(/\/$/);
    await expect(sidebar(page).getByText(role.name)).toBeVisible();
    await page.context().storageState({ path: authFile(role.key) });
  });
}
