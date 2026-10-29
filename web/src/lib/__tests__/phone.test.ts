import { describe, expect, test } from "vitest";
import { maskPhoneE164, normalizePhoneE164 } from "../phone";

describe("normalizePhoneE164", () => {
  test("accepts common separators and coerces to + prefix", () => {
    expect(normalizePhoneE164("+34 600-000-000")).toBe("+34600000000");
    expect(normalizePhoneE164("0034600000000")).toBe("+34600000000");
    expect(normalizePhoneE164("34600000000")).toBe("+34600000000");
  });

  test("rejects invalid input", () => {
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164("1234")).toBeNull();
    expect(normalizePhoneE164("+abc123")).toBeNull();
  });
});

describe("maskPhoneE164", () => {
  test("masks middle digits while preserving country code and suffix", () => {
    expect(maskPhoneE164("+34600000000")).toBe("+34•••••••00");
  });
});
