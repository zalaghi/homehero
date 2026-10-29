import { describe, expect, test } from "vitest";
import type { AttendanceDaySource } from "@prisma/client";
import { mergeAttendanceRecords } from "../merge";

function record(date: string, source: AttendanceDaySource, worked: boolean, authorizedExtra: boolean) {
  return {
    date: new Date(`${date}T00:00:00Z`),
    source,
    worked,
    authorizedExtra,
  } as const;
}

describe("mergeAttendanceRecords", () => {
  test("prefers manual override over UniFi", () => {
    const merged = mergeAttendanceRecords([
      record("2026-01-05", "UNIFI", true, false),
      record("2026-01-05", "MANUAL", false, true),
    ]);

    const day = merged.get("2026-01-05");
    expect(day).toEqual({
      date: "2026-01-05",
      id: null,
      worked: false,
      authorizedExtra: true,
      source: "MANUAL",
      firstEntryTime: null,
      lastExitTime: null,
      uncertainty: false,
    });
  });

  test("falls back to resolved over UniFi when no manual override", () => {
    const merged = mergeAttendanceRecords([
      record("2026-01-06", "UNIFI", false, false),
      record("2026-01-06", "RESOLVED", true, false),
    ]);

    expect(merged.get("2026-01-06")).toMatchObject({
      worked: true,
      authorizedExtra: false,
      source: "RESOLVED",
    });
  });

  test("keeps highest-priority source", () => {
    const merged = mergeAttendanceRecords([
      record("2026-01-07", "RESOLVED", true, false),
      record("2026-01-07", "MANUAL", true, true),
    ]);

    expect(merged.get("2026-01-07")?.source).toBe("MANUAL");
  });
});
