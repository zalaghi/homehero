import { describe, expect, it } from "vitest";
import { buildReceiptLines, renderReceiptPdf, type ReceiptContent } from "../receipt";

describe("receipt rendering", () => {
  const base: ReceiptContent = {
    employeeName: "Test User",
    employeeCurrency: "EUR",
    locale: "fa",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    paymentDate: "2026-02-01",
    status: "PAID",
    note: "پرداخت شد",
    totals: {
      validDays: 5,
      dailyRateCents: 1000,
      grossPayCents: 5000,
      cardExpensesCents: 1200,
      loansCents: 0,
      debtCollectedCents: 200,
      debtStartCents: 1000,
      debtEndCents: 800,
      netPayCents: 3800,
    },
  };

  it("localizes lines and jalali dates", () => {
    const lines = buildReceiptLines(base);
    expect(lines[0]).toContain("رسید حقوق");
    expect(lines[1]).toContain("کارمند");
    expect(lines.some((l) => /[۰-۹]{4}/u.test(l))).toBe(true);
    expect(lines.find((l) => l.includes("خالص"))).toBeDefined();
  });

  it("creates a PDF payload", async () => {
    const pdf = await renderReceiptPdf(base);
    const textStart = Buffer.from(pdf).subarray(0, 8).toString("utf8");
    expect(textStart).toMatch(/^%PDF-1\.[3-7]$/);
  });
});
