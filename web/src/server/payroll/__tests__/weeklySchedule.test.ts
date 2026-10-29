import { describe, it, expect } from "vitest";
import { weeklyEmailDue } from "../weeklySchedule";
describe("Sunday payroll scheduler", () => {
  const activated = new Date("2026-10-28T10:00:00Z");
  it("does not backfill previous weeks or send before 20:00 Madrid", () => {
    expect(weeklyEmailDue(new Date("2026-10-28T20:00:00Z"), activated)).toBeNull();
    expect(weeklyEmailDue(new Date("2026-11-01T18:59:59Z"), activated)).toBeNull();
  });
  it("starts this week and handles winter time", () => {
    expect(weeklyEmailDue(new Date("2026-11-01T19:00:00Z"), activated)).toMatchObject({ startDate: "2026-10-26", endDate: "2026-11-01", dueAt: new Date("2026-11-01T19:00:00Z") });
  });
  it("handles summer time and limited recovery after a restart", () => {
    expect(weeklyEmailDue(new Date("2027-07-04T18:00:00Z"), activated)?.dueAt).toEqual(new Date("2027-07-04T18:00:00Z"));
    expect(weeklyEmailDue(new Date("2026-11-02T09:00:00Z"), activated)?.endDate).toBe("2026-11-01");
    expect(weeklyEmailDue(new Date("2026-11-04T09:00:00Z"), activated)).toBeNull();
  });
});
