import { describe, expect, test } from "vitest";
import { isValidWorkedDay } from "../validWorkedDay";
import type { IsoDate } from "../types";

describe("isValidWorkedDay", () => {
  test("false when not worked", () => {
    const ok = isValidWorkedDay("2026-01-05", false, true, {
      isHoliday: () => false,
    });
    expect(ok).toBe(false);
  });

  test("true on a normal laborable day when worked", () => {
    const ok = isValidWorkedDay("2026-01-05", true, false, {
      isHoliday: () => false,
    });
    expect(ok).toBe(true);
  });

  test("false on weekend/holiday unless authorizedExtra", () => {
    const date = "2026-01-10"; // Saturday
    const isHoliday = (d: IsoDate) => d === "2026-01-06";

    expect(isValidWorkedDay(date, true, false, { isHoliday })).toBe(false);
    expect(isValidWorkedDay(date, true, true, { isHoliday })).toBe(true);

    expect(
      isValidWorkedDay("2026-01-06", true, false, { isHoliday }),
    ).toBe(false);
    expect(
      isValidWorkedDay("2026-01-06", true, true, { isHoliday }),
    ).toBe(true);
  });
});

