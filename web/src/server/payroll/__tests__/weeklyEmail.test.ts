import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ send: vi.fn(), generate: vi.fn(), content: vi.fn(), pdf: vi.fn(), db: { employee: { findMany: vi.fn() }, weeklyPayrollEmail: { upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), update: vi.fn() } } }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: m.send }) } }));
vi.mock("@/server/db/prisma", () => ({ getPrisma: () => m.db }));
vi.mock("../generatePeriod", () => ({ generatePayPeriodForEmployee: m.generate }));
vi.mock("../receipt", () => ({ getReceiptContent: m.content, renderReceiptPdf: m.pdf }));
import { processWeeklyPayrollEmails } from "../weeklyEmail";
const now = new Date("2026-11-01T19:00:00Z");
const employee = { id: "employee", email: "fixture@example.test", firstName: "Fixture", weeklyEmailEnabledAt: new Date("2026-10-28T18:00:00Z") };
const job = { id: "job", employeeId: employee.id, employee, attempts: 0, weekStart: new Date("2026-10-26"), weekEnd: new Date("2026-11-01") };
beforeEach(() => {
  vi.resetAllMocks(); Object.assign(process.env, { SMTP_HOST: "smtp.example.test", SMTP_USER: "fixture@example.test", SMTP_PASS: "fixture", APP_ORIGIN: "https://example.test" });
  m.db.employee.findMany.mockResolvedValue([employee]); m.db.weeklyPayrollEmail.findMany.mockResolvedValue([job]); m.db.weeklyPayrollEmail.updateMany.mockResolvedValue({ count: 1 });
  m.generate.mockResolvedValue({ payPeriodId: "period" }); m.content.mockResolvedValue({ employeeCurrency: "EUR", totals: { validDays: 5, netPayCents: 30000 } }); m.pdf.mockResolvedValue(Buffer.from("fixture-pdf")); m.send.mockResolvedValue({ accepted: [employee.email] });
});
describe("weekly payslip delivery", () => {
  it("does not enqueue historical weeks before activation", async () => {
    m.db.weeklyPayrollEmail.findMany.mockResolvedValue([]);
    await processWeeklyPayrollEmails(new Date("2026-10-28T19:00:00Z"));
    expect(m.db.weeklyPayrollEmail.upsert).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled();
  });
  it("queues one employee/week key, sends the PDF, and records SMTP acceptance", async () => {
    await processWeeklyPayrollEmails(now);
    expect(m.db.weeklyPayrollEmail.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId_weekStart: { employeeId: "employee", weekStart: job.weekStart } } }));
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: employee.email, messageId: "<homehero-weekly-job@example.test>", attachments: [expect.objectContaining({ contentType: "application/pdf" })] }));
    expect(m.db.weeklyPayrollEmail.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SENT", lastError: null }) }));
  });
  it("does not send a job already claimed by another worker", async () => {
    m.db.weeklyPayrollEmail.updateMany.mockResolvedValue({ count: 0 });
    await processWeeklyPayrollEmails(now); expect(m.send).not.toHaveBeenCalled();
  });
  it("retries preparation failure without submitting mail", async () => {
    m.pdf.mockRejectedValue(new Error("fixture")); await processWeeklyPayrollEmails(now);
    expect(m.send).not.toHaveBeenCalled(); expect(m.db.weeklyPayrollEmail.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", lastError: "PDF_PREPARATION_FAILED" }) }));
  });
  it("flags ambiguous SMTP failure for review rather than duplicating a payslip", async () => {
    m.send.mockRejectedValue(new Error("fixture timeout")); await processWeeklyPayrollEmails(now);
    expect(m.db.weeklyPayrollEmail.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REVIEW_REQUIRED", lastError: "SMTP_DELIVERY_UNCONFIRMED" }) }));
  });
});
