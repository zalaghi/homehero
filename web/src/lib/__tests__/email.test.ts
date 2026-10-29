import { describe, expect, test } from "vitest";
import { maskEmail, normalizeEmail } from "../email";

describe("normalizeEmail", () => {
  test("normalizes case and trims", () => {
    expect(normalizeEmail("  USER@example.com  ")).toBe("user@example.com");
  });

  test("rejects invalid addresses", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("not-an-email")).toBeNull();
  });
});

describe("maskEmail", () => {
  test("masks local part while keeping domain", () => {
    expect(maskEmail("user@example.com")).toBe("u••r@example.com");
    expect(maskEmail("ab@example.com")).toBe("a•@example.com");
  });
});
