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
import { POST as createOrderPOST } from "@/app/api/orders/route";
import { db } from "@/db";
import { auditLogs, type UserRole } from "@/db/schema";
import {
  closeDb,
  resetDatabase,
  seedMedication,
  seedUser,
  TEST_PASSWORD,
} from "./helpers";

function req(
  url: string,
  init: { method?: string; body?: unknown; cookie?: string } = {},
): NextRequest {
  const headers = new Headers();
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
  await resetDatabase();
});

afterEach(async () => {
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
        body: { patientName: "X", medicationId: 1, quantity: 1 },
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
          patientName: "End To End",
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
        body: { patientName: "Forbidden Fred", medicationId: med.id, quantity: 1 },
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
        body: { quantity: 500 },
      }),
      { params: Promise.resolve({ id: String(med.id) }) },
    );
    expect(adjustAsPharm.status).toBe(403);

    const adjustAsTech = await adjustStockPOST(
      req(`/api/medications/${med.id}/adjust-stock`, {
        method: "POST",
        cookie: techCookie,
        body: { quantity: 500 },
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
        body: { patientName: "Duplicate Dan", medicationId: med.id, quantity: 2 },
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
        body: { patientName: "Overeager Oliver", medicationId: med.id, quantity: 10 },
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

describe("inventory adjust through the API", () => {
  it("admin adjusts stock; audit row records from/to", async () => {
    const admin = await seedUser("admin");
    const med = await seedMedication(10, 5);
    const adminCookie = await login(admin.email);

    const res = await adjustStockPOST(
      req(`/api/medications/${med.id}/adjust-stock`, {
        method: "POST",
        cookie: adminCookie,
        body: { quantity: 100, reason: "delivery received" },
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
        body: { quantity: -5 },
      }),
      { params: Promise.resolve({ id: String(med.id) }) },
    );
    expect(res.status).toBe(400);
  });
});
