import { test, expect } from "@playwright/test";

import { BASE_URL, authFile, createOrder, expectStatus } from "./helpers";

test("an order moves pending → verified → filled → completed across roles", async ({
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
    // Technician creates the order.
    const orderId = await createOrder(tech, {
      directions: "Take 1 capsule by mouth three times daily for 7 days",
    });
    await expectStatus(tech, "Pending");

    // Pharmacist verifies.
    await pharmacist.goto(`/orders/${orderId}`);
    await expectStatus(pharmacist, "Pending");
    await pharmacist.getByRole("button", { name: "Verify" }).click();
    await expectStatus(pharmacist, "Verified");

    // Technician fills the now-verified order.
    await tech.reload();
    await expectStatus(tech, "Verified");
    await tech.getByRole("button", { name: "Fill" }).click();
    await expectStatus(tech, "Filled");

    // Pharmacist completes the hand-off.
    await pharmacist.reload();
    await expectStatus(pharmacist, "Filled");
    await pharmacist.getByRole("button", { name: "Complete" }).click();
    await expectStatus(pharmacist, "Completed");

    // Every step is captured in the audit log.
    await pharmacist.goto("/audit");
    await expect(pharmacist.getByText(`created order #${orderId}`)).toBeVisible();
    await expect(
      pharmacist.getByText(`moved order #${orderId} from pending to verified`),
    ).toBeVisible();
    // Fills are recorded with stock movement rather than a plain transition.
    await expect(
      pharmacist.getByText(`filled order #${orderId}`),
    ).toBeVisible();
    await expect(
      pharmacist.getByText(`moved order #${orderId} from filled to completed`),
    ).toBeVisible();
  } finally {
    await techContext.close();
    await pharmacistContext.close();
  }
});
