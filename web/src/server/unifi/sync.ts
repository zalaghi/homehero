import { inspectProtect } from "@/lib/unifi/protect";
import { normalizeUnifiEvent } from "@/lib/unifi/events";
import type { IsoDate } from "@/lib/payroll/types";
import { fetchUnifiAccessEvents } from "@/lib/unifi/client";
import type { UnifiConfig } from "@/lib/unifi/config";
import { getPrisma } from "@/server/db/prisma";
import { getUnifiConfigSummary, requireUnifiConfig } from "./config";
import { getDateRangeBounds, isoDateInTimeZone, upsertAttendanceSummaries } from "./attendance";

export async function testUnifiConnection(config: UnifiConfig, fetchImpl?: typeof fetch): Promise<Awaited<ReturnType<typeof inspectProtect>>> {
  return inspectProtect(config, fetchImpl);
}

export async function syncUnifiEvents(opts: { fetchImpl?: typeof fetch } = {}): Promise<{
  processed: number;
  inserted: number;
}> {
  const prisma = getPrisma();
  const config = await requireUnifiConfig();

  const last = await prisma.unifiAccessEvent.findFirst({
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });

  const rawEvents = await fetchUnifiAccessEvents(config, {
    since: last?.occurredAt,
    fetchImpl: opts.fetchImpl,
  });

  const normalized = rawEvents.map(normalizeUnifiEvent);
  const seen = new Set<string>();
  const unique = normalized.filter((e) => {
    if (seen.has(e.stableHash)) return false;
    seen.add(e.stableHash);
    return true;
  });

  if (unique.length === 0) return { processed: 0, inserted: 0 };

  const employees = await prisma.employee.findMany({
    where: { unifiActorId: { not: null } },
    select: { id: true, timezone: true, unifiActorId: true },
  });
  const actorMap = new Map<string, { id: string; timezone: string }>();
  for (const e of employees) {
    if (e.unifiActorId) actorMap.set(e.unifiActorId, { id: e.id, timezone: e.timezone });
  }

  const rows = unique.map((e) => {
    const employee = e.actorId ? actorMap.get(e.actorId) : undefined;
    return {
      occurredAt: e.occurredAt,
      doorId: e.doorId ?? null,
      actorId: e.actorId ?? null,
      direction: e.direction ?? null,
      externalId: e.externalId ?? null,
      stableHash: e.stableHash,
      rawJson: e.rawJson,
      employeeId: employee?.id ?? null,
      timeZone: employee?.timezone ?? null,
    };
  });

  const created = await prisma.unifiAccessEvent.createMany({
    data: rows.map(({ timeZone: _tz, ...rest }) => rest),
    skipDuplicates: true,
  });

  const affected = new Map<string, { timeZone: string; dates: Set<IsoDate> }>();
  for (const row of rows) {
    if (!row.employeeId || !row.timeZone) continue;
    const day = isoDateInTimeZone(row.occurredAt, row.timeZone);
    const existing = affected.get(row.employeeId);
    if (existing) existing.dates.add(day);
    else affected.set(row.employeeId, { timeZone: row.timeZone, dates: new Set([day]) });
  }

  for (const [employeeId, meta] of affected.entries()) {
    const dates = Array.from(meta.dates);
    const { start, endExclusive } = getDateRangeBounds(dates);
    const events = await prisma.unifiAccessEvent.findMany({
      where: { employeeId, occurredAt: { gte: start, lt: endExclusive } },
      orderBy: { occurredAt: "asc" },
    });
    await upsertAttendanceSummaries({ prisma, employeeId, timeZone: meta.timeZone, events });
  }

  return { processed: normalized.length, inserted: created.count };
}

export async function isUnifiConfigured(): Promise<boolean> {
  const summary = await getUnifiConfigSummary();
  return Boolean(summary.host && summary.hasToken);
}
