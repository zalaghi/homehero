import crypto from "node:crypto";

export type UnifiRawEvent = {
  id?: string | number;
  actorId?: string | number;
  occurredAt: string; // ISO datetime
  doorId?: string | number;
  direction?: string;
  [k: string]: unknown;
};

export type NormalizedUnifiEvent = {
  externalId?: string;
  actorId?: string;
  occurredAt: Date;
  doorId?: string;
  direction?: string;
  stableHash: string;
  rawJson: string;
};

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function computeStableUnifiHash(raw: UnifiRawEvent): string {
  const canonical = stableStringify({
    id: raw.id ?? null,
    actorId: raw.actorId ?? null,
    occurredAt: raw.occurredAt,
    doorId: raw.doorId ?? null,
    direction: raw.direction ?? null,
    // Include all fields to reduce collision risk
    raw,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function normalizeUnifiEvent(raw: UnifiRawEvent): NormalizedUnifiEvent {
  const occurredAt = new Date(raw.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error(`Invalid occurredAt: ${raw.occurredAt}`);
  }

  const externalId = raw.id !== undefined ? String(raw.id) : undefined;
  const stableHash = computeStableUnifiHash(raw);

  return {
    externalId,
    actorId: raw.actorId !== undefined ? String(raw.actorId) : undefined,
    doorId: raw.doorId !== undefined ? String(raw.doorId) : undefined,
    direction: raw.direction,
    occurredAt,
    stableHash,
    rawJson: JSON.stringify(raw),
  };
}

