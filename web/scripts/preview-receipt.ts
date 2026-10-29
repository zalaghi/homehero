import { writeFile } from "node:fs/promises";
import { renderReceiptPdf, type ReceiptContent } from "../src/server/payroll/receipt";
const input: ReceiptContent = {
  locale: "es", employeeName: "María Ejemplo", employeeReference: "EJEMPLO-001", employeeCurrency: "EUR",
  reference: "MUESTRA-2026-44", startDate: "2026-10-26", endDate: "2026-11-01", paymentDate: null, status: "DRAFT",
  days: Array.from({ length: 7 }, (_, i) => ({ date: new Date(Date.UTC(2026,9,26+i)).toISOString().slice(0,10) as ReceiptContent["startDate"], worked: i < 5, counted: i < 5, holiday: false, weekend: i >= 5 })),
  movements: [{ date: "2026-10-29", description: "Compra personal", amountCents: 2000, kind: "expense" }, { date: "2026-11-01", description: "Cuota semanal", amountCents: 3000, kind: "collection" }],
  totals: { validDays: 5, dailyRateCents: 7000, grossPayCents: 35000, cardExpensesCents: 2000, loansCents: 0, debtCollectedCents: 3000, debtStartCents: 20000, debtEndCents: 17000, netPayCents: 30000 },
};
void renderReceiptPdf(input).then(bytes => writeFile(process.argv[2] || "/tmp/HomeHero-payslip-sample.pdf", bytes));
