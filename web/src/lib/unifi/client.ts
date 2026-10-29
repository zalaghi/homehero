import type { UnifiConfig } from "./config";
import type { UnifiRawEvent } from "./events";

async function withTlsOption<T>(tlsVerify: boolean, fn: () => Promise<T>): Promise<T> {
  if (tlsVerify) return fn();
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
  }
}

function coerceIsoString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

function extractRawEvents(payload: unknown): unknown[] {
  if (!payload) return [];
  if (Array.isArray((payload as { data?: unknown[] }).data)) {
    return (payload as { data: unknown[] }).data;
  }
  if (Array.isArray(payload)) return payload as unknown[];
  return [];
}

export type FetchUnifiEventsOptions = {
  since?: Date;
  limit?: number;
  fetchImpl?: typeof fetch;
};

export async function fetchUnifiAccessEvents(
  config: UnifiConfig,
  opts: FetchUnifiEventsOptions = {},
): Promise<UnifiRawEvent[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = config.host.endsWith("/") ? config.host.slice(0, -1) : config.host;
  const url = new URL("/api/v2/access/events", base);
  if (opts.since) url.searchParams.set("since", opts.since.toISOString());
  url.searchParams.set("limit", String(opts.limit ?? 200));

  const res = await withTlsOption(config.tlsVerify, () =>
    fetchImpl(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${config.token}` },
    }),
  );

  if (!res.ok) {
    throw new Error(`UniFi request failed (${res.status})`);
  }

  const payload = await res.json().catch(() => null);
  const rawEvents = extractRawEvents(payload);

  return rawEvents.flatMap((e) => {
    const obj = e as Record<string, unknown>;
    const occurredAt = coerceIsoString(obj.timestamp ?? obj.occurredAt ?? obj.time ?? obj.ts);
    if (!occurredAt) return [];

    const rawId = obj.id ?? obj._id ?? obj.event_id ?? obj.uuid;
    const rawActorId = obj.actorId ?? obj.actor_id ?? obj.userId ?? obj.user_id;
    const rawDoorId = obj.doorId ?? obj.door_id ?? (obj.source as { id?: unknown } | undefined)?.id;
    const rawDirection = obj.direction ?? obj.action ?? obj.type;

    const event: UnifiRawEvent = {
      id: typeof rawId === "string" || typeof rawId === "number" ? rawId : undefined,
      actorId: typeof rawActorId === "string" || typeof rawActorId === "number" ? rawActorId : undefined,
      occurredAt,
      doorId: typeof rawDoorId === "string" || typeof rawDoorId === "number" ? rawDoorId : undefined,
      direction: typeof rawDirection === "string" ? rawDirection : undefined,
      ...obj,
    };
    return [event];
  });
}
