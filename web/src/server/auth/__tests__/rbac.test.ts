import { afterEach, describe, expect, it, vi } from "vitest";
import { assertRole } from "../session";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requireRole", () => {
  it("returns the user when the role matches", async () => {
    const user = { userId: "u1", role: "ADMIN" as const, employeeId: null };
    expect(assertRole(user, "ADMIN")).toEqual(user);
  });

  it("throws on mismatched roles", async () => {
    const user = { userId: "u2", role: "EMPLOYEE" as const, employeeId: "e2" };
    expect(() => assertRole(user, "ADMIN")).toThrow("Unauthorized");
  });
});
