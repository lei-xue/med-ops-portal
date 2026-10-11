import { expect, type Page } from "@playwright/test";

/** Base URL used when a test opens its own browser context (outside the `use` fixtures). */
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3940";

export const PASSWORD = "demo1234!";

export interface Role {
  key: "technician" | "pharmacist" | "admin";
  label: string;
  name: string;
  email: string;
}

export const ROLES: readonly Role[] = [
  {
    key: "technician",
    label: "Technician",
    name: "Theo Technician",
    email: "tech@demo.local",
  },
  {
    key: "pharmacist",
    label: "Pharmacist",
    name: "Priya Pharmacist",
    email: "pharmacist@demo.local",
  },
  {
    key: "admin",
    label: "Admin",
    name: "Ada Admin",
    email: "admin@demo.local",
  },
];

export function authFile(key: Role["key"]): string {
  return `e2e/.auth/${key}.json`;
}

/** Sign in through the real login form (used by both setup and specs). */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export interface CreateOrderOptions {
  quantity?: number;
  directions?: string;
}

/**
 * Create a pending order through the UI and return its id.
 *
 * Defaults to the first seeded patient, product and prescriber — meds/patients
 * are sorted by name, so index 1 is Amoxicillin 250 mg capsule and Avery Example.
 */
export async function createOrder(
  page: Page,
  options: CreateOrderOptions = {},
): Promise<number> {
  await page.goto("/orders/new");
  await page.getByLabel("Patient").selectOption({ index: 1 });
  await page.getByLabel("Medication").selectOption({ index: 1 });
  await page.getByLabel("Prescriber").selectOption({ index: 1 });
  await page.getByLabel("Quantity").fill(String(options.quantity ?? 1));
  if (options.directions) {
    await page.getByLabel("Directions (sig)").fill(options.directions);
  }
  await page.getByRole("button", { name: "Create order" }).click();
  await page.waitForURL(/\/orders\/\d+$/);
  const match = page.url().match(/\/orders\/(\d+)$/);
  if (!match) throw new Error(`No order id in URL: ${page.url()}`);
  return Number(match[1]);
}

/** The status pill renders the exact label (compare via { exact: true }). */
export async function expectStatus(page: Page, label: string) {
  await expect(page.getByText(label, { exact: true })).toBeVisible();
}

/**
 * The desktop sidebar. Scoping here avoids matching the signed-in user's name
 * a second time in dashboard/audit activity feeds.
 */
export function sidebar(page: Page) {
  return page.locator("aside").first();
}
