import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ upsert: vi.fn(), deleteMany: vi.fn(), user: vi.fn(), origin: vi.fn(), rate: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrisma: () => ({ $transaction: (fn: (tx: unknown) => unknown) => fn({ employeePushSubscription: { upsert: m.upsert, deleteMany: m.deleteMany } }) }) }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: m.user }));
vi.mock("@/server/security/csrf", () => ({ assertSameOrigin: m.origin }));
vi.mock("@/server/security/rateLimit", () => ({ rateLimitFixedWindow: m.rate }));
import { POST } from "../route";
function request(endpoint = "https://fcm.googleapis.com/fcm/send/fixture") { return new Request("https://app.test/api/employee/push-subscriptions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh: "A".repeat(87), auth: "A".repeat(22) } }) }); }
beforeEach(() => { vi.clearAllMocks(); m.user.mockResolvedValue({ userId: "user", role: "EMPLOYEE", employeeId: "employee" }); m.origin.mockResolvedValue(undefined); m.rate.mockResolvedValue({ ok: true }); m.upsert.mockResolvedValue({ id: "sub" }); });
describe("device registration", () => {
  it("registers the current employee and removes stale account ownership", async () => {
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(m.deleteMany).toHaveBeenCalledWith({ where: { endpoint: "https://fcm.googleapis.com/fcm/send/fixture", employeeId: { not: "employee" } } });
    expect(await response.json()).toEqual({ ok: true, subscriptionId: "sub" });
  });
  it("rejects endpoints on private services", async () => { expect((await POST(request("http://127.0.0.1:3000/admin"))).status).toBe(400); expect(m.upsert).not.toHaveBeenCalled(); });
  it("requires an employee session", async () => { m.user.mockResolvedValue(null); expect((await POST(request())).status).toBe(401); });
});
