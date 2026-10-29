import { describe, expect, test } from "vitest";
import { computePayrollTotals } from "../calculate";

describe("computePayrollTotals", () => {
  test("weekly: valid days, expenses, loans, collected", () => {
    const totals = computePayrollTotals({
      period: { startDate: "2026-01-05", endDate: "2026-01-11" },
      dailyRateCents: 50_00,
      debtStartCents: 100_00,
      attendanceDays: [
        { date: "2026-01-05", worked: true, authorizedExtra: false }, // Mon valid
        { date: "2026-01-06", worked: true, authorizedExtra: false }, // Tue but holiday => invalid
        { date: "2026-01-10", worked: true, authorizedExtra: false }, // Sat => invalid
        { date: "2026-01-10", worked: true, authorizedExtra: true }, // Sat authorized => valid
      ],
      cardExpenses: [{ date: "2026-01-07", amountCents: 12_34 }],
      debtTransactions: [
        { date: "2026-01-08", type: "LOAN_GIVEN", amountCents: 20_00 },
        { date: "2026-01-09", type: "DEBT_COLLECTED", amountCents: 15_00 },
      ],
      validityContext: {
        isHoliday: (d) => d === "2026-01-06",
      },
    });

    expect(totals.validDays).toBe(2);
    expect(totals.grossPayCents).toBe(100_00);
    expect(totals.cardExpensesCents).toBe(12_34);
    expect(totals.loansCents).toBe(20_00);
    expect(totals.debtCollectedCents).toBe(15_00);
    expect(totals.debtStartCents).toBe(100_00);
    expect(totals.debtEndCents).toBe(105_00); // 100 + 20 - 15
    expect(totals.netPayCents).toBe(100_00 - 12_34 - 15_00 + 20_00);
  });
});

