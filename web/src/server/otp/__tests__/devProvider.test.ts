import { describe, expect, test, vi } from "vitest";
import { DevOtpProvider, hashOtpCode } from "../devProvider";

describe("DevOtpProvider", () => {
  test("hashOtpCode is deterministic and doesn't store plaintext", () => {
    process.env.OTP_PEPPER = "pepper";
    const h1 = hashOtpCode({ challengeId: "c1", recipient: "user@example.com", code: "123456" });
    const h2 = hashOtpCode({ challengeId: "c1", recipient: "user@example.com", code: "123456" });
    expect(h1).toBe(h2);
    expect(h1).not.toContain("123456");
  });

  test("send+verify roundtrip (dev-only)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.OTP_DEV_ALLOWED = "true";
    process.env.OTP_PEPPER = "pepper";

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const p = new DevOtpProvider();
    const { challengeId } = await p.sendCode("user@example.com", { locale: "en", purpose: "EMPLOYEE_LOGIN" });

    // Extract the code from the server log (dev-only behavior)
    const msg = String(log.mock.calls.at(-1)?.[0] ?? "");
    const code = msg.match(/code=(\d{6})/)?.[1];
    expect(code).toMatch(/^\d{6}$/);

    await expect(p.verifyCode(challengeId, code!, "victim@example.com")).resolves.toBe(false);
    await expect(p.verifyCode(challengeId, code!, "user@example.com")).resolves.toBe(true);
    await expect(p.verifyCode(challengeId, "000000", "user@example.com")).resolves.toBe(false);

    await expect(p.verifyCode(challengeId, code!, "user@example.com")).resolves.toBe(false);
    log.mockRestore();
    vi.unstubAllEnvs();
  });
});

