import type { IsoDate } from "./types";

export function parseIsoDate(date: IsoDate): Date {
  // Interpret DATE-only values in UTC to avoid timezone surprises.
  // DB stores DATE; we treat it as yyyy-mm-dd at 00:00:00Z.
  return new Date(`${date}T00:00:00.000Z`);
}

export function formatIsoDateUTC(d: Date): IsoDate {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}` as IsoDate;
}

export function isWeekendUTC(date: IsoDate): boolean {
  const d = parseIsoDate(date);
  const dow = d.getUTCDay(); // 0=Sun ... 6=Sat
  return dow === 0 || dow === 6;
}

export function isWithinInclusive(date: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return date >= start && date <= end;
}

