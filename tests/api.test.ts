import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST as adjustStockPOST } from "@/app/api/medications/[id]/adjust-stock/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as completePOST } from "@/app/api/orders/[id]/complete/route";
import { POST as cancelPOST } from "@/app/api/orders/[id]/cancel/route";
import { GET as getOrderGET } from "@/app/api/orders/[id]/route";
import { POST as fillPOST } from "@/app/api/orders/[id]/fill/route";
import { POST as verifyPOST } from "@/app/api/orders/[id]/verify/route";
import { GET as healthGET } from "@/app/api/health/route";
import { POST as createOrderPOST } from "@/app/api/orders/route";
import { db } from "@/db";
import { auditLogs, type UserRole } from "@/db/schema";
import { settleAuditWrites } from "@/lib/authService";
import { resetLoginRateLimits } from "@/lib/loginRateLimit";
import {
  closeDb,
  resetDatabase,
  seedMedication,
  seedParties,
  seedUser,
  TEST_PASSWORD,
} from "./helpers";

function req(
  url: string,
  init: {
    method?: string;
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (init.cookie) {
    headers.set("cookie", init.cookie);
  }
  return new NextRequest(`http://localhost${url}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function login(email: string): Promise<string> {
  const res = await loginPOST(
    req("/api/auth/login", {
      method: "POST",
      body: { email, password: TEST_PASSWORD },
    }),
  );
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie");
  expect(setCookie).toBeDefined();
  return setCookie!.split(";")[0];
}

beforeEach(async () => {
  resetLoginRateLimits();
  await resetDatabase();
});

afterEach(async () => {
  // Failed-login audit rows are written in the background; let them land
  // before truncating so none leak into the next test.
  await settleAuditWrites();
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("POST /api/auth/login", () => {
  it("mints a session readable over https (proxy salt parity)", async () => {
    const user = await seedUser("pharmacist");
    const loginRes = await loginPOST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
          "x-forwarded-proto": "https",
        }),
        body: JSON.stringify({ email: user.email, password: TEST_PASSWORD }),
      }),
    );
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toContain("__Secure-authjs.session-token=");
    const cookie = setCookie!.split(";")[0];

    const { readSessionFromRequest } = await import("@/lib/session");
    const session = await readSessionFromRequest(
      new NextRequest("http://localhost/api/orders", {
        headers: new Headers({ "x-forwarded-proto": "https", cookie }),
      }),
    );
    expect(session?.email).toBe(user.email);
    expect(session?.role).toBe("pharmacist");
  });

  it("rejects bad credentials with 401", async () => {
    const user = await seedUser("technician");
    const res = await loginPOST(
      req("/api/auth/login", {
        method: "POST",
        body: { email: user.email, password: "wrong-password" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects malformed payloads with 400", async () => {
    const res = await loginPOST(
      req("/api/auth/login", {
        method: "POST",
        body: { email: "not-an-email", password: "" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("logs in each demo role and issues a session cookie", async () => {
    for (const role of ["admin", "pharmacist", "technician"] as UserRole[]) {
      const user = await seedUser(role);
      const cookie = await login(user.email);
      expect(cookie).toMatch(/^authjs\.session-token=/);

      const res = await loginPOST(
        req("/api/auth/login", {
          method: "POST",
          body: { email: user.email, password: TEST_PASSWORD },
        }),
      );
      const body = await res.json();
      expect(body.user.role).toBe(role);
      expect(body.user.email).toBe(user.email);
    }
  });
});

describe("order lifecycle through the API", () => {
  it("401s when unauthenticated", async () => {
    const res = await createOrderPOST(
      req("/api/orders", {
        method: "POST",
        body: { patientId: 1, prescriberId: 1, medicationId: 1, quantity: 1 },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("runs create → verify → fill → complete end-to-end across roles", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication(20, 5);

    const techCookie = await login(tech.email);
    const pharmCookie = await login(pharm.email);

    // 1. Technician creates the order.
    const created = await createOrderPOST(
      req("/api/orders", {
        method: "POST",
        cookie: techCookie,
        body: {
          ...(await seedParties("End To End")),
          medicationId: med.id,
          quantity: 4,
          notes: "integration test",
        },
      }),
    );
    expect(created.status).toBe(201);
    const { order } = await created.json();
    expect(order.status).toBe("pending");
    const orderId = order.id as number;

    // 2. Pharmacist verifies.
    const verified = await verifyPOST(
      req(`/api/orders/${orderId}/verify`, { method: "POST", cookie: pharmCookie }),
      { params: Promise.resolve({ id: String(orderId) }) },
    );
    expect(verified.status).toBe(200);
    expect((await verified.json()).order.status).toBe("verified");

    // 3. Technician fills (stock decrement happens here).
    const filled = await fillPOST(
      req(`/api/orders/${orderId}/fill`, { method: "POST", cookie: techCookie }),
      { params: Promise.resolve({ id: String(orderId) }) },
    );
    expect(filled.status).toBe(200);
    expect((await filled.json()).order.status).toBe("filled");

    // 4. Pharmacist completes.
    const completed = await completePOST(
      req(`/api/orders/${orderId}/complete`, {
        method: "POST",
        cookie: pharmCookie,
      }),
      { params: Promise.resolve({ id: String(orderId) }) },
    );
    expect(completed.status).toBe(200);
    expect((await completed.json()).order.status).toBe("completed");

    // Final state via GET endpoint: status completed, stock decremented.
    const detail = await getOrderGET(
      req(`/api/orders/${orderId}`, { cookie: techCookie }),
      { params: Promise.resolve({ id: String(orderId) }) },
    );
    expect(detail.status).toBe(200);
    const body = await detail.json();
    expect(body.order.status).toBe("completed");
    expect(body.order.medicationStockQuantity).toBe(16);

    // Audit trail has one row per mutation (order entity rows only —
    // user.login rows can share the same numeric entity id).
    const audits = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityId, orderId),
          eq(auditLogs.entityType, "medication_order"),
        ),
      );
    const actions = audits.map((a) => a.action).sort();
    expect(actions).toEqual([
      "order.complete",
      "order.create",
      "order.fill",
      "order.verify",
    ]);
  });
});

describe("API role enforcement", () => {
  it("403s on illegal role actions", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication();

    const techCookie = await login(tech.email);
    const pharmCookie = await login(pharm.email);

    const created = await createOrderPOST(
      req("/api/orders", {
        method: "POST",
        cookie: techCookie,
        body: { ...(await seedParties("Forbidden Fred")), medicationId: med.id, quantity: 1 },
      }),
    );
    const { order } = await created.json();
    const orderId = String(order.id);

    // Technician cannot verify, complete, cancel.
    for (const [handler, name] of [
      [verifyPOST, "verify"],
      [completePOST, "complete"],
      [cancelPOST, "cancel"],
    ] as const) {
      const res = await handler(
        req(`/api/orders/${orderId}/${name}`, { method: "POST", cookie: techCookie }),
        { params: Promise.resolve({ id: orderId }) },
      );
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("FORBIDDEN");
    }

    // Pharmacist can verify but cannot adjust stock.
    const verifyRes = await verifyPOST(
      req(`/api/orders/${orderId}/verify`, { method: "POST", cookie: pharmCookie }),
      { params: Promise.resolve({ id: orderId }) },
    );
    expect(verifyRes.status).toBe(200);

    const adjustAsPharm = await adjustStockPOST(
      req(`/api/medications/${med.id}/adjust-stock`, {
        method: "POST",
        cookie: pharmCookie,
        body: { quantity: 500, expectedQuantity: 0 },
      }),
      { params: Promise.resolve({ id: String(med.id) }) },
    );
    expect(adjustAsPharm.status).toBe(403);

    const adjustAsTech = await adjustStockPOST(
      req(`/api/medications/${med.id}/adjust-stock`, {
        method: "POST",
        cookie: techCookie,
        body: { quantity: 500, expectedQuantity: 0 },
      }),
      { params: Promise.resolve({ id: String(med.id) }) },
    );
    expect(adjustAsTech.status).toBe(403);
  });

  it("409s on invalid transitions and keeps state intact", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication();

    const techCookie = await login(tech.email);
    const pharmCookie = await login(pharm.email);

    const created = await createOrderPOST(
      req("/api/orders", {
        method: "POST",
        cookie: techCookie,
        body: { ...(await seedParties("Duplicate Dan")), medicationId: med.id, quantity: 2 },
      }),
    );
    const { order } = await created.json();
    const orderId = String(order.id);

    await verifyPOST(
      req(`/api/orders/${orderId}/verify`, { method: "POST", cookie: pharmCookie }),
      { params: Promise.resolve({ id: orderId }) },
    );
    const secondVerify = await verifyPOST(
      req(`/api/orders/${orderId}/verify`, { method: "POST", cookie: pharmCookie }),
      { params: Promise.resolve({ id: orderId }) },
    );
    expect(secondVerify.status).toBe(409);
    expect((await secondVerify.json()).code).toBe("INVALID_TRANSITION");
  });

  it("409s on insufficient stock without changing stock", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication(3, 1);

    const techCookie = await login(tech.email);
    const pharmCookie = await login(pharm.email);

    const created = await createOrderPOST(
      req("/api/orders", {
        method: "POST",
        cookie: techCookie,
        body: { ...(await seedParties("Overeager Oliver")), medicationId: med.id, quantity: 10 },
      }),
    );
    const { order } = await created.json();
    const orderId = String(order.id);

    await verifyPOST(
      req(`/api/orders/${orderId}/verify`, { method: "POST", cookie: pharmCookie }),
      { params: Promise.resolve({ id: orderId }) },
    );

    const fillRes = await fillPOST(
      req(`/api/orders/${orderId}/fill`, { method: "POST", cookie: techCookie }),
      { params: Promise.resolve({ id: orderId }) },
    );
    expect(fillRes.status).toBe(409);
    expect((await fillRes.json()).code).toBe("INSUFFICIENT_STOCK");

    const detail = await getOrderGET(
      req(`/api/orders/${orderId}`, { cookie: techCookie }),
      { params: Promise.resolve({ id: orderId }) },
    );
    const body = await detail.json();
    expect(body.order.status).toBe("verified");
    expect(body.order.medicationStockQuantity).toBe(3);
  });

  it("returns 404 for unknown orders", async () => {
    const pharm = await seedUser("pharmacist");
    const pharmCookie = await login(pharm.email);

    const res = await verifyPOST(
      req("/api/orders/99999/verify", { method: "POST", cookie: pharmCookie }),
      { params: Promise.resolve({ id: "99999" }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("prescription rules through the API", () => {
  it("returns a field error when an Rx product has no prescriber", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication(20, 5, { rxStatus: "rx" });
    const { patientId } = await seedParties("No Prescriber");
    const cookie = await login(tech.email);

    const res = await createOrderPOST(
      req("/api/orders", {
        method: "POST",
        cookie,
        body: { patientId, medicationId: med.id, quantity: 1 },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fieldErrors?.prescriberId?.[0]).toMatch(/prescription-only/);
  });

  it("order detail links the patient and prescriber", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication(20, 5);
    const parties = await seedParties("Linked Lou");
    const cookie = await login(tech.email);

    const created = await createOrderPOST(
      req("/api/orders", {
        method: "POST",
        cookie,
        body: { ...parties, medicationId: med.id, quantity: 2, refills: 1, daysSupply: 30 },
      }),
    );
    const { order } = await created.json();
    const detail = await getOrderGET(req(`/api/orders/${order.id}`, { cookie }), {
      params: Promise.resolve({ id: String(order.id) }),
    });
    const body = await detail.json();
    expect(body.order.patient).toMatchObject({ id: parties.patientId, name: "Linked Lou" });
    expect(body.order.prescriberId).toBe(parties.prescriberId);
    expect(body.order).toMatchObject({ refills: 1, daysSupply: 30 });
  });
});

describe("inventory adjust through the API", () => {
  it("requires expectedQuantity so writes can't skip the concurrency check", async () => {
    const admin = await seedUser("admin");
    const med = await seedMedication(10, 5);
    const adminCookie = await login(admin.email);

    const res = await adjustStockPOST(
      req(`/api/medications/${med.id}/adjust-stock`, {
        method: "POST",
        cookie: adminCookie,
        body: { quantity: 50 },
      }),
      { params: Promise.resolve({ id: String(med.id) }) },
    );
    expect(res.status).toBe(400);
  });

  it("409s with STALE_STOCK when stock moved since the admin loaded it", async () => {
    const admin = await seedUser("admin");
    const med = await seedMedication(10, 5);
    const adminCookie = await login(admin.email);

    const res = await adjustStockPOST(
      req(`/api/medications/${med.id}/adjust-stock`, {
        method: "POST",
        cookie: adminCookie,
        body: { quantity: 50, expectedQuantity: 12 },
      }),
      { params: Promise.resolve({ id: String(med.id) }) },
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "STALE_STOCK" });
  });

  it("admin adjusts stock; audit row records from/to", async () => {
    const admin = await seedUser("admin");
    const med = await seedMedication(10, 5);
    const adminCookie = await login(admin.email);

    const res = await adjustStockPOST(
      req(`/api/medications/${med.id}/adjust-stock`, {
        method: "POST",
        cookie: adminCookie,
        body: { quantity: 100, reason: "delivery received", expectedQuantity: 10 },
      }),
      { params: Promise.resolve({ id: String(med.id) }) },
    );
    expect(res.status).toBe(200);
    const { medication } = await res.json();
    expect(medication.stockQuantity).toBe(100);

    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "inventory.adjust"));
    expect(audits).toHaveLength(1);
    expect(audits[0].details).toMatchObject({ from: 10, to: 100 });
  });

  it("400s on invalid quantities", async () => {
    const admin = await seedUser("admin");
    const med = await seedMedication();
    const adminCookie = await login(admin.email);

    const res = await adjustStockPOST(
      req(`/api/medications/${med.id}/adjust-stock`, {
        method: "POST",
        cookie: adminCookie,
        body: { quantity: -5, expectedQuantity: 100 },
      }),
      { params: Promise.resolve({ id: String(med.id) }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("login hardening", () => {
  it("rate-limits repeated attempts on one account with 429 + Retry-After", async () => {
    const user = await seedUser("technician");
    const attempt = () =>
      loginPOST(
        req("/api/auth/login", {
          method: "POST",
          body: { email: user.email, password: "wrong-password" },
          headers: { "x-forwarded-for": "203.0.113.7" },
        }),
      );

    for (let i = 0; i < 5; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("limits attempts on one account even when they come from many addresses", async () => {
    const user = await seedUser("technician");
    const statuses: number[] = [];
    for (let i = 0; i < 21; i += 1) {
      const res = await loginPOST(
        req("/api/auth/login", {
          method: "POST",
          body: { email: user.email, password: "wrong-password" },
          headers: { "cf-connecting-ip": `198.51.100.${i}` },
        }),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it("audits failed sign-ins on existing accounts with IP and user agent", async () => {
    const user = await seedUser("pharmacist");
    const res = await loginPOST(
      req("/api/auth/login", {
        method: "POST",
        body: { email: user.email, password: "wrong-password" },
        headers: { "x-forwarded-for": "198.51.100.4", "user-agent": "vitest" },
      }),
    );
    expect(res.status).toBe(401);

    await settleAuditWrites();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "user.login_failed"),
          eq(auditLogs.actorId, user.id),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0].details).toMatchObject({
      email: user.email,
      ip: "198.51.100.4",
      userAgent: "vitest",
    });
    expect(JSON.stringify(rows[0].details)).not.toContain("wrong-password");
  });

  it("rejects oversized bodies with 413 before parsing", async () => {
    const res = await loginPOST(
      req("/api/auth/login", {
        method: "POST",
        body: { email: "a@b.co", password: "x".repeat(20_000) },
      }),
    );
    expect(res.status).toBe(413);
  });
});

describe("GET /api/health", () => {
  it("reports ok when the database answers", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("page proxy", () => {
  type Proxy = (r: NextRequest, ctx: unknown) => Promise<Response>;
  // Auth.js rebuilds the request URL from Host and X-Forwarded-Proto
  // (defaulting to https). Browsers send Host; Cloudflare sets the protocol.
  const page = (url: string, cookie?: string) =>
    req(url, {
      cookie,
      headers: { host: "localhost", "x-forwarded-proto": "http" },
    });

  it("sends signed-out visitors to /login, keeping path and query", async () => {
    const proxy = (await import("@/proxy")).default as unknown as Proxy;
    const res = await proxy(page("/orders?status=pending"), {});
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe(
      "/orders?status=pending",
    );
  });

  it("lets signed-in users through and bounces them off /login", async () => {
    const proxy = (await import("@/proxy")).default as unknown as Proxy;
    const user = await seedUser("pharmacist");
    const cookie = await login(user.email);

    const orders = await proxy(page("/orders", cookie), {});
    expect(orders.headers.get("location")).toBeNull();

    const loginPage = await proxy(page("/login", cookie), {});
    expect(new URL(loginPage.headers.get("location")!).pathname).toBe("/");
  });
});
