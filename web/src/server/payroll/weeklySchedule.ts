import type { IsoDate } from "@/lib/payroll/types";
import { getPayPeriodForDate } from "@/lib/payroll/periods";
function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}
export function weeklyEmailDue(now: Date, enabledAt: Date, timeZone = "Europe/Madrid") {
  const p = localParts(now, timeZone);
  const localDay = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dow = localDay.getUTCDay();
  localDay.setUTCDate(localDay.getUTCDate() - dow - (dow === 0 && p.hour < 20 ? 7 : 0));
  const end = localDay.toISOString().slice(0, 10) as IsoDate;
  // Resolve Sunday 20:00 in its own timezone; DST is applied at that date.
  const wall = new Date(`${end}T20:00:00Z`);
  let due = wall;
  for (let i = 0; i < 3; i++) {
    const at = localParts(due, timeZone);
    const represented = Date.UTC(at.year, at.month - 1, at.day, at.hour, at.minute, at.second);
    due = new Date(due.getTime() + wall.getTime() - represented);
  }
  // Never backfill before activation; allow up to 48h recovery after a restart.
  if (due < enabledAt || due > now || now.getTime() - due.getTime() > 48 * 3600000) return null;
  return { ...getPayPeriodForDate(end, "WEEKLY_ISO"), dueAt: due };
}
