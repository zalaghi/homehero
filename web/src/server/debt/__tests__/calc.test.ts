import { describe, it, expect } from "vitest";
import { calculateDebtBalance, calculateDebtPaidTotal, calculateDebtSnapshot } from "../calc";

describe("debt calculations", () => {
  it("calculates balance with voided transactions excluded", () => {
    const balance = calculateDebtBalance({
      openingDebtCents: 10000,
      transactions: [
        { type: "LOAN_GIVEN", amountCents: 5000 },
        { type: "DEBT_COLLECTED", amountCents: 2000 },
        { type: "LOAN_GIVEN", amountCents: 1500, voidedAt: new Date() },
      ],
    });
    expect(balance).toBe(13000);
  });

  it("calculates paid total with voided exclusions", () => {
    const paid = calculateDebtPaidTotal([
      { type: "DEBT_COLLECTED", amountCents: 2000 },
      { type: "DEBT_COLLECTED", amountCents: 500, voidedAt: new Date() },
    ]);
    expect(paid).toBe(2000);
  });

  it("summarizes debt with opening balance and voids", () => {
    const snapshot = calculateDebtSnapshot({
      openingDebtCents: 5000,
      transactions: [
        { type: "LOAN_GIVEN", amountCents: 2000 },
        { type: "DEBT_COLLECTED", amountCents: 1000 },
        { type: "DEBT_COLLECTED", amountCents: 500, voidedAt: new Date() },
      ],
    });
    expect(snapshot.balanceCents).toBe(6000);
    expect(snapshot.paidTotalCents).toBe(1000);
    expect(snapshot.activeTransactions.length).toBe(2);
  });
});
