import { describe, expect, test } from "vitest";
import { buildAttendanceAuditMetadata } from "../audit";

describe("buildAttendanceAuditMetadata", () => {
  test("captures previous and next states", () => {
    const metadata = buildAttendanceAuditMetadata({
      employeeId: "emp1",
      date: "2026-01-05",
      previous: { worked: false, authorizedExtra: false },
      next: { worked: true, authorizedExtra: true },
    });

    expect(metadata).toEqual({
      employeeId: "emp1",
      date: "2026-01-05",
      previous: { worked: false, authorizedExtra: false },
      next: { worked: true, authorizedExtra: true },
    });
  });

  test("omits previous when none existed", () => {
    const metadata = buildAttendanceAuditMetadata({
      employeeId: "emp2",
      date: "2026-01-06",
      next: { worked: true, authorizedExtra: false },
    });

    expect(metadata.previous).toBeNull();
    expect(metadata.next).toEqual({ worked: true, authorizedExtra: false });
  });
});
