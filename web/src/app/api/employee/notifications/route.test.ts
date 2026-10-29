import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: m.user }));
vi.mock("@/server/db/prisma", () => ({ getPrisma: () => ({ employeeNotification: { updateMany: m.updateMany } }) }));
vi.mock("@/server/security/csrf", () => ({ assertSameOrigin: async () => {} }));
vi.mock("@/server/security/rateLimit", () => ({ rateLimitFixedWindow: async () => ({ ok: true }) }));
import { PATCH } from "./route";
beforeEach(() => { vi.clearAllMocks(); m.user.mockResolvedValue({ role: "EMPLOYEE", employeeId: "current-employee" }); m.updateMany.mockResolvedValue({ count: 3 }); });
function request(body?: string) { return new Request("https://homehero.example/api/employee/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, ...(body !== undefined ? { body } : {}) }); }
describe("mark all notifications read", () => {
  it("accepts the empty-body PATCH sent by already-installed PWA clients", async () => {
    const response=await PATCH(request()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true, updated: 3 });
    expect(m.updateMany).toHaveBeenCalledWith({ where: { employeeId: "current-employee", readAt: null }, data: { readAt: expect.any(Date) } });
  });
  it("accepts an explicit empty object from new clients", async () => { expect((await PATCH(request("{}"))).status).toBe(200); });
  it("can mark a single category without touching other types", async () => {
    expect((await PATCH(request('{"type":"TODO_ASSIGNED"}'))).status).toBe(200);
    expect(m.updateMany.mock.calls[0][0].where).toEqual({ employeeId: "current-employee", readAt: null, type: "TODO_ASSIGNED" });
  });
  it.each(['{"type":', '{"type":"unknown"}', 'null', '{"employeeId":"other-employee"}'])("rejects malformed or unsupported input: %s", async body => {
    expect((await PATCH(request(body))).status).toBe(400); expect(m.updateMany).not.toHaveBeenCalled();
  });
  it("requires an employee session", async () => { m.user.mockResolvedValue({ role: "ADMIN" }); expect((await PATCH(request())).status).toBe(401); expect(m.updateMany).not.toHaveBeenCalled(); });
  it("is safe when every notification has already been read", async () => { m.updateMany.mockResolvedValue({ count: 0 }); const response=await PATCH(request("{}")); expect(await response.json()).toEqual({ok: true,updated:0}); });
});
