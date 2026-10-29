import { describe, expect, test, vi } from "vitest";
import { fetchUnifiAccessEvents } from "../client";
import type { UnifiConfig } from "../config";

const config: UnifiConfig = { host: "https://unifi.test", token: "t", tlsVerify: true };

describe("fetchUnifiAccessEvents", () => {
  test("maps payload into raw events", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              event_id: 10,
              timestamp: "2026-01-01T08:00:00Z",
              actor_id: "emp-1",
              door_id: "door-1",
              direction: "IN",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const events = await fetchUnifiAccessEvents(config, { fetchImpl: mockFetch });
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(10);
    expect(events[0].occurredAt).toBe("2026-01-01T08:00:00.000Z");
    expect(events[0].doorId).toBe("door-1");
    expect(events[0].actorId).toBe("emp-1");
  });

  test("throws when UniFi responds with error", async () => {
    const mockFetch = vi.fn(async () => new Response("oops", { status: 500 }));
    await expect(fetchUnifiAccessEvents(config, { fetchImpl: mockFetch })).rejects.toThrow(/UniFi request failed/);
  });
});
