import { describe, expect, test } from "vitest";
import { computeDebtBalanceBeforeDate } from "../debt";

describe("computeDebtBalanceBeforeDate", () => {
  test("computes loans - collected before start date", () => {
    const balance = computeDebtBalanceBeforeDate(
      [
        { date: "2026-01-01", type: "LOAN_GIVEN", amountCents: 1000 },
        { date: "2026-01-03", type: "DEBT_COLLECTED", amountCents: 200 },
        { date: "2026-01-05", type: "LOAN_GIVEN", amountCents: 300 },
      ],
      "2026-01-05",
    );
    expect(balance).toBe(800); // 1000-200 ; excludes tx on 2026-01-05
  });

  test("includes opening balance for carry-over debt", () => {
    const balance = computeDebtBalanceBeforeDate(
      [
        { date: "2025-12-15", type: "DEBT_COLLECTED", amountCents: 500_00 },
        { date: "2026-01-02", type: "LOAN_GIVEN", amountCents: 1_000_00 },
      ],
      "2026-02-01",
      4_000_00,
    );
    // opening 4000 + loan 1000 - collected 500 = 4500
    expect(balance).toBe(4_500_00);
  });
});

