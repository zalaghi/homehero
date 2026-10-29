import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ otpChallenge: { findUnique: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() } }));
vi.mock("@/server/db/prisma", () => ({ getPrisma: () => db }));
import { SmtpOtpProvider } from "../smtpProvider";
describe("SMTP OTP recipient binding and replay", () => {
  beforeEach(() => {
    vi.clearAllMocks(); process.env.OTP_PEPPER = "test-pepper";
    db.otpChallenge.findUnique.mockResolvedValue({ id: "challenge", recipient: "owner@example.test", provider: "SMTP", attempts: 0, expiresAt: new Date(Date.now()+60000), devCodeHash: crypto.createHmac("sha256", "test-pepper").update("challenge:owner@example.test:123456").digest("base64") });
    db.otpChallenge.deleteMany.mockResolvedValue({ count: 1 });
  });
  it("never turns another recipient's valid OTP into a session", async () => {
    expect(await new SmtpOtpProvider().verifyCode("challenge", "123456", "victim@example.test")).toBe(false);
    expect(db.otpChallenge.deleteMany).not.toHaveBeenCalled();
  });
  it("requires a successful atomic consumption", async () => {
    const provider = new SmtpOtpProvider();
    expect(await provider.verifyCode("challenge", "123456", "owner@example.test")).toBe(true);
    db.otpChallenge.deleteMany.mockResolvedValue({ count: 0 });
    expect(await provider.verifyCode("challenge", "123456", "owner@example.test")).toBe(false);
  });
});
