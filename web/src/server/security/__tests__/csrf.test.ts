import { afterEach, describe, expect, it, vi } from "vitest";

import { assertSameOrigin } from "../csrf";

const headerValues: Record<string, string | null> = {};

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (key: string) => headerValues[key] ?? null,
  }),
}));

describe("assertSameOrigin", () => {
  afterEach(() => {
    headerValues.origin = null;
    headerValues["x-forwarded-host"] = null;
    headerValues["x-forwarded-proto"] = null;
    headerValues.host = null;
    delete process.env.APP_ORIGIN;
  });

  it("allows requests from configured allowlist origins", async () => {
    process.env.APP_ORIGIN = "https://app.example.com, https://portal.example.com";
    headerValues.origin = "https://portal.example.com";

    await expect(assertSameOrigin()).resolves.toBeUndefined();
  });

  it("rejects requests from non-allowlisted origins", async () => {
    process.env.APP_ORIGIN = "https://app.example.com, https://portal.example.com";
    headerValues.origin = "https://evil.example.com";

    await expect(assertSameOrigin()).rejects.toThrow("CSRF: origin mismatch");
  });
});
