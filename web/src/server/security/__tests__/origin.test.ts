import { describe, it, expect } from "vitest";
import { isAllowedOrigin } from "../origin";
describe("request origin boundary", () => {
  it("rejects a foreign Origin even when forwarded headers describe the real app", () => {
    expect(isAllowedOrigin(new Headers({ origin: "https://attacker.test", "x-forwarded-host": "app.test", "x-forwarded-proto": "https" }), "https://app.test")).toBe(false);
  });
  it("supports configured origins without allowing null origins", () => {
    expect(isAllowedOrigin(new Headers({ origin: "https://app.test" }), "https://app.test, https://other.test")).toBe(true);
    expect(isAllowedOrigin(new Headers({ origin: "null" }), "https://app.test")).toBe(false);
  });
  it("rejects cross-site requests with missing Origin", () => {
    expect(isAllowedOrigin(new Headers({ "sec-fetch-site": "cross-site" }), "https://app.test")).toBe(false);
  });
  it("supports same-origin LAN installations without a configured origin", () => {
    expect(isAllowedOrigin(new Headers({ origin: "http://192.0.2.1:3000", host: "192.0.2.1:3000" }), "")).toBe(true);
    expect(isAllowedOrigin(new Headers({ origin: "https://attacker.test", host: "192.0.2.1:3000" }), "")).toBe(false);
  });
});
