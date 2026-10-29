import type { DebtTransactionInput, IsoDate } from "./types";

/**
 * Compute debt balance at the start of a period (exclusive of startDate).
 * debt = loans - collected for all tx with date < startDate.
 */
export function computeDebtBalanceBeforeDate(
  txs: DebtTransactionInput[],
  startDate: IsoDate,
  openingBalanceCents = 0,
): number {
  let balance = openingBalanceCents;

  for (const t of txs) {
    if (t.date >= startDate) continue;
    balance += t.type === "LOAN_GIVEN"
      ? t.amountCents
      : -t.amountCents;
  }

  return balance;
}


