import { describe, expect, it } from "vitest";
import { getPayPeriodForDate } from "../periods";
import { computePayrollTotals } from "../calculate";
import { computeDebtBalanceBeforeDate } from "../debt";

const weekend = new Set(["2026-01-10", "2026-01-11"]);

function isWeekend(date: string) {
  return weekend.has(date);
}

describe("payroll totals", () => {
  it("computes weekly totals with opening balances and expenses", () => {
    const debtTx: import("../types").DebtTransactionInput[] = [
      { date: "2026-01-04", type: "LOAN_GIVEN" as const, amountCents: 5000 },
      { date: "2026-01-07", type: "DEBT_COLLECTED" as const, amountCents: 2000 },
    ];
    const debtStart = computeDebtBalanceBeforeDate(debtTx, "2026-01-05", 1000);

    const totals = computePayrollTotals({
      period: { startDate: "2026-01-05", endDate: "2026-01-11" },
      dailyRateCents: 4000,
      debtStartCents: debtStart,
      attendanceDays: [
        { date: "2026-01-05", worked: true, authorizedExtra: false },
        { date: "2026-01-10", worked: true, authorizedExtra: true },
      ],
      cardExpenses: [{ date: "2026-01-06", amountCents: 1200 }],
      debtTransactions: debtTx,
      validityContext: { isHoliday: () => false, isWeekend },
    });

    expect(debtStart).toBe(6000);
    expect(totals.validDays).toBe(2);
    expect(totals.grossPayCents).toBe(8000);
    expect(totals.cardExpensesCents).toBe(1200);
    expect(totals.debtCollectedCents).toBe(2000);
    expect(totals.netPayCents).toBe(4800);
    expect(totals.debtEndCents).toBe(4000);
  });

  it("builds calendar month periods at end of month", () => {
    const p = getPayPeriodForDate("2026-01-31", "MONTHLY");
    expect(p.startDate).toBe("2026-01-01");
    expect(p.endDate).toBe("2026-01-31");
  });
});
