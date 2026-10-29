import { describe, expect, test } from "vitest";
import { computeStableUnifiHash, normalizeUnifiEvent } from "../events";

describe("UniFi event normalization + dedupe hash", () => {
  test("stable hash stays stable for same input", () => {
    const raw = {
      id: "evt_1",
      actorId: "actor_9",
      occurredAt: "2026-01-01T08:00:00.000Z",
      doorId: "door_1",
      direction: "IN",
      extra: { a: 1, b: 2 },
    };

    expect(computeStableUnifiHash(raw)).toBe(computeStableUnifiHash(raw));
  });

  test("normalizeUnifiEvent extracts ids and parses date", () => {
    const n = normalizeUnifiEvent({
      id: 123,
      actorId: 456,
      occurredAt: "2026-01-01T08:00:00.000Z",
      doorId: 789,
      direction: "OUT",
    });

    expect(n.externalId).toBe("123");
    expect(n.actorId).toBe("456");
    expect(n.doorId).toBe("789");
    expect(n.occurredAt.toISOString()).toBe("2026-01-01T08:00:00.000Z");
    expect(n.stableHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("stable hash ignores object key order", () => {
    const a = {
      id: "evt-1",
      actorId: "actor-1",
      occurredAt: "2026-01-01T08:00:00.000Z",
      doorId: "door-1",
      direction: "IN",
      extra: { a: 1, b: 2 },
    };
    const b = {
      direction: "IN",
      doorId: "door-1",
      occurredAt: "2026-01-01T08:00:00.000Z",
      actorId: "actor-1",
      id: "evt-1",
      extra: { b: 2, a: 1 },
    };

    expect(computeStableUnifiHash(a)).toBe(computeStableUnifiHash(b));
  });
});

