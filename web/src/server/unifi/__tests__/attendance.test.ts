import { describe, expect, test } from "vitest";
import { isoDateInTimeZone, summarizeEventsByDate } from "../attendance";

const tz = "Europe/Madrid";

describe("summarizeEventsByDate", () => {
  test("captures first entry, last exit, and certainty", () => {
    const events = [
      { occurredAt: new Date("2026-01-01T08:00:00Z"), direction: "IN" },
      { occurredAt: new Date("2026-01-01T17:00:00Z"), direction: "OUT" },
    ];

    const [summary] = summarizeEventsByDate(events, tz);
    expect(summary.worked).toBe(true);
    expect(summary.uncertainty).toBe(false);
    expect(summary.firstEntryTime?.toISOString()).toBe("2026-01-01T08:00:00.000Z");
    expect(summary.lastExitTime?.toISOString()).toBe("2026-01-01T17:00:00.000Z");
  });

  test("flags uncertainty when missing exit", () => {
    const events = [{ occurredAt: new Date("2026-01-02T07:30:00Z"), direction: "IN" }];
    const [summary] = summarizeEventsByDate(events, tz);
    expect(summary.worked).toBe(true);
    expect(summary.uncertainty).toBe(true);
    expect(summary.lastExitTime?.toISOString()).toBe("2026-01-02T07:30:00.000Z");
  });

  test("groups by timezone calendar day", () => {
    const localTz = "Asia/Tokyo";
    const events = [
      { occurredAt: new Date("2026-01-01T22:30:00Z"), direction: "IN" },
      { occurredAt: new Date("2026-01-01T23:50:00Z"), direction: "OUT" },
    ];
    const summaries = summarizeEventsByDate(events, localTz);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].date).toBe(isoDateInTimeZone(new Date("2026-01-01T22:30:00Z"), localTz));
  });
});
