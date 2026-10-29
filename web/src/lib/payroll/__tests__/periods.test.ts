import { describe, expect, test } from "vitest";
import { getPayPeriodForDate } from "../periods";

describe("getPayPeriodForDate", () => {
  test("weekly ISO (Mon-Sun)", () => {
    // Wed -> same week Mon..Sun
    const p = getPayPeriodForDate("2026-01-07", "WEEKLY_ISO");
    expect(p.startDate).toBe("2026-01-05");
    expect(p.endDate).toBe("2026-01-11");
  });

  test("monthly (calendar month)", () => {
    const p = getPayPeriodForDate("2026-02-10", "MONTHLY");
    expect(p.startDate).toBe("2026-02-01");
    expect(p.endDate).toBe("2026-02-28");
  });
});

