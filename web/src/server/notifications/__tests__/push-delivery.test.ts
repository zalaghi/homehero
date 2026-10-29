import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), db: { employeePushSubscription: { findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() }, employee: { findUnique: vi.fn() }, employeeNotification: { create: vi.fn(), count: vi.fn() }, notificationDelivery: { create: vi.fn(), update: vi.fn() } } }));
vi.mock("web-push", () => ({ default: { sendNotification: mocks.send } }));
vi.mock("@/server/db/prisma", () => ({ getPrisma: () => mocks.db }));
import { sendToSubscription, sendEmployeePush } from "../push";
import { isTrustedPushEndpoint } from "../pushEndpoint";
import { validReceiptToken, receiptToken } from "../receiptToken";
const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/fixture", p256dh: "fixture", auth: "fixture" };
const payload = { employeeId: "fixture", title: "Test", body: "Test", type: "TODO_ASSIGNED" };
beforeEach(() => { vi.clearAllMocks(); process.env.VAPID_PUBLIC_KEY = "fixture"; process.env.VAPID_PRIVATE_KEY = "fixture"; process.env.VAPID_SUBJECT = "mailto:test@example.test"; process.env.OTP_PEPPER = "fixture"; });
describe("push transport", () => {
  it("supports Apple/Google and refuses private or arbitrary endpoints", () => {
    expect(isTrustedPushEndpoint(sub.endpoint)).toBe(true);
    expect(isTrustedPushEndpoint("https://web.push.apple.com/fixture")).toBe(true);
    for (const url of ["http://127.0.0.1/", "https://evil.test", "https://fcm.googleapis.com.evil.test", "https://fcm.googleapis.com:1234/"]) expect(isTrustedPushEndpoint(url)).toBe(false);
  });
  it("preserves transient failures for retries", async () => {
    mocks.send.mockRejectedValue({ statusCode: 503 });
    expect(await sendToSubscription(sub, payload)).toMatchObject({ accepted: false, retryable: true, expired: false });
  });
  it("recognizes an expired subscription", async () => {
    mocks.send.mockRejectedValue({ statusCode: 410 });
    expect(await sendToSubscription(sub, payload)).toMatchObject({ accepted: false, expired: true, retryable: false });
  });
  it("sends a bounded, high-urgency request", async () => {
    mocks.send.mockResolvedValue({ statusCode: 201 });
    expect(await sendToSubscription(sub, payload)).toMatchObject({ accepted: true });
    expect(mocks.send.mock.calls[0][2]).toMatchObject({ TTL: 86400, urgency: "high", timeout: 10000 });
  });
  it("binds device receipts to a single delivery", () => {
    const token = receiptToken("one");
    expect(validReceiptToken("one", token)).toBe(true);
    expect(validReceiptToken("two", token)).toBe(false);
    expect(validReceiptToken("one", "wrong")).toBe(false);
  });
});

it("persists an explicit diagnostic in the inbox and sends its badge count and device receipt token", async () => {
  mocks.db.employee.findUnique.mockResolvedValue({ locale: "en", publicId: "fixture" });
  mocks.db.employeePushSubscription.findMany.mockResolvedValue([{ id: "subscription", ...sub }]);
  mocks.db.employeeNotification.create.mockResolvedValue({ id: "notification" });
  mocks.db.employeeNotification.count.mockResolvedValue(2);
  mocks.db.notificationDelivery.create.mockResolvedValue({ id: "delivery" });
  mocks.send.mockResolvedValue({ statusCode: 201 });
  expect(await sendEmployeePush(payload)).toMatchObject({ sent: 1, failed: 0 });
  const body = JSON.parse(mocks.send.mock.calls[0][1]);
  expect(body).toMatchObject({ unreadCount: 2, deliveryId: "delivery", notificationId: "notification", url: "/en/portal/fixture/notifications" });
  expect(validReceiptToken("delivery", body.receiptToken)).toBe(true);
  expect(mocks.db.notificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ACCEPTED" }) }));
});
