import type {
  AttendanceDayInput,
  CardExpenseInput,
  DebtTransactionInput,
  IsoDate,
  PayrollTotals,
} from "./types";
import { isWithinInclusive } from "./date";
import { isValidWorkedDay, type ValidWorkedDayContext } from "./validWorkedDay";

export type ComputePayrollInput = {
  period: { startDate: IsoDate; endDate: IsoDate };
  dailyRateCents: number;
  debtStartCents: number;
  attendanceDays: AttendanceDayInput[];
  cardExpenses: CardExpenseInput[];
  debtTransactions: DebtTransactionInput[];
  validityContext: ValidWorkedDayContext;
};

/**
 * Period totals mirror (and improve on) the workbook:
 * - validDays = SUM(validWorkedDay)
 * - gross = validDays * dailyRate
 * - deductions = card expenses in period
 * - debt ledger movement:
 *   - loans increase debt and ALSO increase cash-out to employee (net += loans)
 *   - collected decreases debt and reduces cash-out (net -= collected)
 * - net = gross - expenses - collected + loans
 * - debtEnd = debtStart + loans - collected
 */
export function computePayrollTotals(input: ComputePayrollInput): PayrollTotals {
  const { startDate, endDate } = input.period;

  let validDays = 0;
  for (const d of input.attendanceDays) {
    if (!isWithinInclusive(d.date, startDate, endDate)) continue;
    if (isValidWorkedDay(d.date, d.worked, d.authorizedExtra, input.validityContext)) validDays += 1;
  }

  const grossPayCents = validDays * input.dailyRateCents;

  let cardExpensesCents = 0;
  for (const e of input.cardExpenses) {
    if (!isWithinInclusive(e.date, startDate, endDate)) continue;
    cardExpensesCents += e.amountCents;
  }

  let loansCents = 0;
  let debtCollectedCents = 0;
  for (const t of input.debtTransactions) {
    if (!isWithinInclusive(t.date, startDate, endDate)) continue;
    if (t.type === "LOAN_GIVEN") loansCents += t.amountCents;
    else debtCollectedCents += t.amountCents;
  }

  const debtEndCents = input.debtStartCents + loansCents - debtCollectedCents;
  const netPayCents = grossPayCents - cardExpensesCents - debtCollectedCents + loansCents;

  return {
    validDays,
    grossPayCents,
    cardExpensesCents,
    loansCents,
    debtCollectedCents,
    netPayCents,
    debtStartCents: input.debtStartCents,
    debtEndCents,
  };
}

