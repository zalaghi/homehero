import type { IsoDate } from "@/lib/payroll/types";
import { formatIsoDateUTC, parseIsoDate } from "@/lib/payroll/date";
import { isWeekendInTimeZone } from "@/lib/attendance/calendar";
import { computePayrollTotals } from "@/lib/payroll/calculate";
import { computeDebtBalanceBeforeDate } from "@/lib/payroll/debt";

export function isoDateNowInTimeZone(timeZone: string): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}` as IsoDate;
}

function addDaysUTC(date: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatIsoDateUTC(d);
}

export function startOfIsoWeekInTimeZone(today: IsoDate, timeZone: string): IsoDate {
  // Use noon UTC to avoid DST edge cases.
  const base = parseIsoDate(today);
  const noonUtc = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12, 0, 0));
  const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(noonUtc);
  const isoDay =
    weekdayShort === "Mon"
      ? 1
      : weekdayShort === "Tue"
        ? 2
        : weekdayShort === "Wed"
          ? 3
          : weekdayShort === "Thu"
            ? 4
            : weekdayShort === "Fri"
              ? 5
              : weekdayShort === "Sat"
                ? 6
                : 7;
  return addDaysUTC(today, -(isoDay - 1));
}

export function endOfIsoWeekInTimeZone(today: IsoDate, timeZone: string): IsoDate {
  return addDaysUTC(startOfIsoWeekInTimeZone(today, timeZone), 6);
}

export function startOfMonth(today: IsoDate): IsoDate {
  return `${today.slice(0, 7)}-01` as IsoDate;
}

export function startOfYear(today: IsoDate): IsoDate {
  return `${today.slice(0, 4)}-01-01` as IsoDate;
}

export function summarizeForPeriod(input: {
  startDate: IsoDate;
  endDate: IsoDate;
  dailyRateCents: number;
  timeZone: string;
  holidaySet: Set<IsoDate>;
  attendanceDays: Array<{ date: IsoDate; worked: boolean; authorizedExtra: boolean }>;
  cardExpenses: Array<{ date: IsoDate; amountCents: number }>;
  debtTransactionsAll: Array<{ date: IsoDate; type: "LOAN_GIVEN" | "DEBT_COLLECTED"; amountCents: number }>;
  openingDebtCents: number;
}) {
  const debtStartCents = computeDebtBalanceBeforeDate(
    input.debtTransactionsAll,
    input.startDate,
    input.openingDebtCents,
  );
  const totals = computePayrollTotals({
    period: { startDate: input.startDate, endDate: input.endDate },
    dailyRateCents: input.dailyRateCents,
    debtStartCents,
    attendanceDays: input.attendanceDays,
    cardExpenses: input.cardExpenses,
    debtTransactions: input.debtTransactionsAll,
    validityContext: {
      isHoliday: (d) => input.holidaySet.has(d),
      isWeekend: (d) => isWeekendInTimeZone(d, input.timeZone),
    },
  });
  return totals;
}

