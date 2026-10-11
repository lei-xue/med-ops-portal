import { test, expect } from "@playwright/test";

import { createOrder, expectStatus } from "./helpers";

// Runs in the default pharmacist session (see playwright.config.ts).
test("a pharmacist can cancel a pending order", async ({ page }) => {
  const orderId = await createOrder(page);
  await expectStatus(page, "Pending");

  await page.getByRole("button", { name: "Cancel" }).click();
  await expectStatus(page, "Cancelled");

  // A cancelled order is terminal, so the row offers no further actions.
  await expect(page.getByRole("button", { name: "Verify" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fill" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Complete" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);

  await page.goto("/audit");
  await expect(
    page.getByText(`moved order #${orderId} from pending to cancelled`),
  ).toBeVisible();
});
