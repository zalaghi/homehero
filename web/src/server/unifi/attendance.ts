import type { AttendanceDay, PrismaClient, UnifiAccessEvent } from "@prisma/client";
import type { IsoDate } from "@/lib/payroll/types";
import { parseIsoDate } from "@/lib/payroll/date";
import { toDbDate } from "@/lib/holidays/importers";

export function isoDateInTimeZone(d: Date, timeZone: string): IsoDate {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(d) as IsoDate;
}

export type AttendanceSummary = {
  date: IsoDate;
  firstEntryTime: Date | null;
  lastExitTime: Date | null;
  worked: boolean;
  uncertainty: boolean;
};

export function summarizeEventsByDate(
  events: Pick<UnifiAccessEvent, "occurredAt" | "direction">[],
  timeZone: string,
): AttendanceSummary[] {
  const byDate = new Map<IsoDate, Pick<UnifiAccessEvent, "occurredAt" | "direction">[]>();
  for (const ev of events) {
    const iso = isoDateInTimeZone(ev.occurredAt, timeZone);
    const list = byDate.get(iso);
    if (list) list.push(ev);
    else byDate.set(iso, [ev]);
  }

  const summaries: AttendanceSummary[] = [];
  for (const [date, evts] of byDate.entries()) {
    const sorted = [...evts].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const hasIn = sorted.some((e) => e.direction?.toUpperCase() === "IN");
    const hasOut = sorted.some((e) => e.direction?.toUpperCase() === "OUT");

    const firstEntry =
      sorted.find((e) => e.direction?.toUpperCase() === "IN") ??
      (sorted.length > 0 ? sorted[0] : undefined);
    const lastExit =
      [...sorted].reverse().find((e) => e.direction?.toUpperCase() === "OUT") ??
      (sorted.length > 0 ? sorted[sorted.length - 1] : undefined);

    const worked = sorted.length > 0;
    const uncertainty = !hasIn || !hasOut || (firstEntry && lastExit ? firstEntry.occurredAt > lastExit.occurredAt : false);

    summaries.push({
      date,
      firstEntryTime: firstEntry?.occurredAt ?? null,
      lastExitTime: lastExit?.occurredAt ?? null,
      worked,
      uncertainty,
    });
  }

  return summaries;
}

export async function upsertAttendanceSummaries(opts: {
  prisma: PrismaClient;
  employeeId: string;
  timeZone: string;
  events: UnifiAccessEvent[];
}): Promise<void> {
  const { prisma, employeeId, timeZone, events } = opts;
  const summaries = summarizeEventsByDate(events, timeZone);
  if (summaries.length === 0) return;

  const dates = summaries.map((s) => s.date);
  const existing = await prisma.attendanceDay.findMany({
    where: { employeeId, date: { in: dates.map(toDbDate) } },
  });
  const existingByIso = new Map<IsoDate, AttendanceDay>();
  for (const d of existing) existingByIso.set(isoDateInTimeZone(d.date, timeZone), d);

  for (const summary of summaries) {
    const current = existingByIso.get(summary.date);
    const baseUpdate = {
      firstEntryTime: summary.firstEntryTime,
      lastExitTime: summary.lastExitTime,
      uncertainty: summary.uncertainty,
    } satisfies Partial<AttendanceDay>;

    if (!current) {
      await prisma.attendanceDay.create({
        data: {
          employeeId,
          date: toDbDate(summary.date),
          worked: summary.worked,
          authorizedExtra: false,
          ...baseUpdate,
          source: "UNIFI",
        },
      });
      continue;
    }

    const updateWorked = current.source !== "MANUAL";
    await prisma.attendanceDay.update({
      where: { id: current.id },
      data: {
        ...baseUpdate,
        ...(updateWorked ? { worked: summary.worked, source: "UNIFI" } : {}),
      },
    });
  }
}

export function getDateRangeBounds(dates: IsoDate[]): { start: Date; endExclusive: Date } {
  const sorted = [...dates].sort();
  const start = parseIsoDate(sorted[0]);
  const endExclusive = new Date(parseIsoDate(sorted[sorted.length - 1]).getTime() + 24 * 60 * 60 * 1000);
  return { start, endExclusive };
}
