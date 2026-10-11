import { test, expect } from "@playwright/test";

import {
  BASE_URL,
  authFile,
  createOrder,
  expectStatus,
} from "./helpers";

test("a technician on a verified order is offered fill only", async ({
  browser,
}) => {
  const techContext = await browser.newContext({
    baseURL: BASE_URL,
    storageState: authFile("technician"),
  });
  const pharmacistContext = await browser.newContext({
    baseURL: BASE_URL,
    storageState: authFile("pharmacist"),
  });
  const tech = await techContext.newPage();
  const pharmacist = await pharmacistContext.newPage();

  try {
    const orderId = await createOrder(tech);

    await pharmacist.goto(`/orders/${orderId}`);
    await pharmacist.getByRole("button", { name: "Verify" }).click();
    await expectStatus(pharmacist, "Verified");

    await tech.goto(`/orders/${orderId}`);
    await expectStatus(tech, "Verified");
    await expect(tech.getByRole("button", { name: "Fill" })).toBeVisible();
    await expect(tech.getByRole("button", { name: "Verify" })).toHaveCount(0);
    await expect(tech.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    await expect(tech.getByRole("button", { name: "Complete" })).toHaveCount(0);
  } finally {
    await techContext.close();
    await pharmacistContext.close();
  }
});

test.describe("inventory adjustment is admin-only", () => {
  // Pharmacist is the default session.
  test("a pharmacist sees no adjust controls", async ({ page }) => {
    await page.goto("/medications");
    await expect(
      page.getByRole("columnheader", { name: "Adjust stock" }),
    ).toHaveCount(0);
    await expect(page.getByLabel(/New stock quantity/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  });

  test("an admin can adjust stock inline", async ({ browser }) => {
    const adminContext = await browser.newContext({
      baseURL: BASE_URL,
      storageState: authFile("admin"),
    });
    const admin = await adminContext.newPage();
    try {
      await admin.goto("/medications");
      await expect(
        admin.getByRole("columnheader", { name: "Adjust stock" }),
      ).toBeVisible();
      const input = admin.getByLabel(/New stock quantity/).first();
      await expect(input).toBeVisible();

      // Re-save the current value so repeated runs don't drift the seed.
      const current = await input.inputValue();
      await input.fill(current);
      await admin.getByRole("button", { name: "Save" }).first().click();
      await expect(admin.getByText("Saved")).toBeVisible();
    } finally {
      await adminContext.close();
    }
  });
});

test.describe("audit log access", () => {
  test("is available to a pharmacist", async ({ page }) => {
    await page.goto("/audit");
    await expect(
      page.getByRole("heading", { level: 1, name: "Audit log" }),
    ).toBeVisible();
  });

  test("redirects a technician away", async ({ browser }) => {
    const techContext = await browser.newContext({
      baseURL: BASE_URL,
      storageState: authFile("technician"),
    });
    const tech = await techContext.newPage();
    try {
      await tech.goto("/audit");
      await expect(tech).toHaveURL(/\/$/);
      await expect(
        tech.getByRole("heading", { level: 1, name: /Welcome back/ }),
      ).toBeVisible();
      await expect(
        tech.getByRole("link", { name: "Audit log" }),
      ).toHaveCount(0);
    } finally {
      await techContext.close();
    }
  });
});
