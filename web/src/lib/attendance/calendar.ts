import type { IsoDate } from "@/lib/payroll/types";
import { formatIsoDateUTC, parseIsoDate } from "@/lib/payroll/date";

function addDaysUTC(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function listIsoDatesInclusive(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  let cur = parseIsoDate(start);
  const endD = parseIsoDate(end);
  while (cur.getTime() <= endD.getTime()) {
    out.push(formatIsoDateUTC(cur));
    cur = addDaysUTC(cur, 1);
  }
  return out;
}

export function isWeekendInTimeZone(date: IsoDate, timeZone: string): boolean {
  // Determine weekday in the employee timezone.
  // Use noon UTC to avoid DST edge cases around midnight.
  const base = parseIsoDate(date);
  const noonUtc = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(noonUtc);
  return weekday === "Sat" || weekday === "Sun";
}

