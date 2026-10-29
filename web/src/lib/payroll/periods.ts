import type { IsoDate, PayFrequency, PayPeriod } from "./types";
import { formatIsoDateUTC, parseIsoDate } from "./date";

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfIsoWeekUTC(anyDate: Date): Date {
  // ISO week starts Monday.
  const dow = anyDate.getUTCDay(); // 0=Sun ... 6=Sat
  const diffToMonday = (dow + 6) % 7; // Mon->0 ... Sun->6
  return addDaysUTC(anyDate, -diffToMonday);
}

function endOfIsoWeekUTC(anyDate: Date): Date {
  return addDaysUTC(startOfIsoWeekUTC(anyDate), 6);
}

function startOfMonthUTC(anyDate: Date): Date {
  return new Date(Date.UTC(anyDate.getUTCFullYear(), anyDate.getUTCMonth(), 1));
}

function endOfMonthUTC(anyDate: Date): Date {
  return new Date(Date.UTC(anyDate.getUTCFullYear(), anyDate.getUTCMonth() + 1, 0));
}

export function getPayPeriodForDate(date: IsoDate, frequency: PayFrequency): PayPeriod {
  const d = parseIsoDate(date);
  if (frequency === "WEEKLY_ISO") {
    return {
      frequency,
      startDate: formatIsoDateUTC(startOfIsoWeekUTC(d)),
      endDate: formatIsoDateUTC(endOfIsoWeekUTC(d)),
    };
  }

  return {
    frequency,
    startDate: formatIsoDateUTC(startOfMonthUTC(d)),
    endDate: formatIsoDateUTC(endOfMonthUTC(d)),
  };
}

