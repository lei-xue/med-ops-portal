import { test, expect } from "@playwright/test";

import { sidebar } from "./helpers";

// Runs in the default pharmacist session (see playwright.config.ts), which can
// see every top-level destination including the audit log.

const NAV_ITEMS: { label: string; path: string; heading: string | RegExp }[] = [
  { label: "Dashboard", path: "/", heading: /Welcome back/ },
  { label: "Orders", path: "/orders", heading: "Medication orders" },
  { label: "Patients", path: "/patients", heading: "Patients" },
  { label: "Prescribers", path: "/prescribers", heading: "Prescribers" },
  { label: "Inventory", path: "/medications", heading: "Inventory" },
  { label: "Audit log", path: "/audit", heading: "Audit log" },
  { label: "FHIR feed", path: "/fhir", heading: "FHIR feed" },
];

for (const item of NAV_ITEMS) {
  test(`the sidebar navigates to ${item.label}`, async ({ page }) => {
    await page.goto("/");
    const navLink = sidebar(page).getByRole("link", {
      name: item.label,
      exact: true,
    });
    await navLink.click();

    const escapedPath = item.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await expect(page).toHaveURL(new RegExp(`${escapedPath}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: item.heading }),
    ).toBeVisible();
    await expect(navLink).toHaveAttribute("aria-current", "page");
  });
}

test("an order row opens the order detail", async ({ page }) => {
  await page.goto("/orders");
  await page.locator("tbody tr").first().getByRole("link").first().click();

  await expect(page).toHaveURL(/\/orders\/\d+$/);
  await expect(page.getByRole("link", { name: "← Medication orders" })).toBeVisible();
});

test("a patient row opens the patient detail", async ({ page }) => {
  await page.goto("/patients");
  await page.locator("tbody tr").first().getByRole("link").first().click();

  await expect(page).toHaveURL(/\/patients\/\d+$/);
  await expect(page.getByRole("link", { name: "← Patients" })).toBeVisible();
});

test("a prescriber row opens the prescriber detail", async ({ page }) => {
  await page.goto("/prescribers");
  await page.locator("tbody tr").first().getByRole("link").first().click();

  await expect(page).toHaveURL(/\/prescribers\/\d+$/);
  await expect(page.getByRole("link", { name: "← Prescribers" })).toBeVisible();
});

test("an inventory row opens the product detail", async ({ page }) => {
  await page.goto("/medications");
  await page.locator("tbody tr").first().getByRole("link").first().click();

  await expect(page).toHaveURL(/\/medications\/\d+$/);
  await expect(page.getByRole("link", { name: "← Inventory" })).toBeVisible();
});
