import { beforeEach, describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({ employee: { findUnique: vi.fn() }, payPeriod: { createMany: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() }, attendanceDay: { findMany: vi.fn() }, cardExpense: { findMany: vi.fn() }, debtTransaction: { findMany: vi.fn() } }));
vi.mock("@/server/db/prisma", () => ({ getPrisma: () => db }));
vi.mock("@/server/attendance/holidayLookup", () => ({ getHolidaySetForEmployee: async () => new Set() }));
import { generatePayPeriodForEmployee } from "../generatePeriod";
beforeEach(() => {
  vi.clearAllMocks();
  db.employee.findUnique.mockResolvedValue({ id: "employee", payFrequency: "MONTHLY", dailyRateCents: 5000, currency: "EUR", timezone: "Europe/Madrid", openingDebtCents: 10000 });
  db.payPeriod.findUniqueOrThrow.mockResolvedValue({ id: "period" }); db.payPeriod.updateMany.mockResolvedValue({ count: 1 });
  db.attendanceDay.findMany.mockResolvedValue([]); db.cardExpense.findMany.mockResolvedValue([]);
  db.debtTransaction.findMany.mockImplementation(async ({ where }) => where.voidedAt === null ? [] : [{ date: new Date("2026-01-01"), type: "LOAN_GIVEN", amountCents: 9999 }]);
});
describe("payroll consistency", () => {
  it("excludes voided debt from the opening balance and period totals", async () => {
    await generatePayPeriodForEmployee({ employeeId: "employee", anchorDate: "2026-02-10" });
    expect(db.payPeriod.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ debtStartCents: 10000, debtEndCents: 10000, netPayCents: 0 })], skipDuplicates: true }));
  });
  it("does not overwrite paid snapshots", async () => {
    db.payPeriod.updateMany.mockResolvedValue({ count: 0 });
    await generatePayPeriodForEmployee({ employeeId: "employee", anchorDate: "2026-02-10" });
    expect(db.payPeriod.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(db.payPeriod.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "period", status: "DRAFT", paidAt: null } }));
  });
});
