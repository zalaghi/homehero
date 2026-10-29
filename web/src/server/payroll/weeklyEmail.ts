import nodemailer from "nodemailer";
import { getPrisma } from "@/server/db/prisma";
import { generatePayPeriodForEmployee } from "./generatePeriod";
import { getReceiptContent, renderReceiptPdf } from "./receipt";
import { weeklyEmailDue } from "./weeklySchedule";
import type { IsoDate } from "@/lib/payroll/types";
function mailConfig() {
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  const from = process.env.NOTIFY_FROM_EMAIL || user;
  if (!host || !user || !pass || !from) return null;
  return { host, user, pass, from, port: Number(process.env.SMTP_PORT || "587") };
}
export async function processWeeklyPayrollEmails(now = new Date()) {
  const prisma = getPrisma();
  const employees = await prisma.employee.findMany({ where: { weeklyEmailEnabled: true, email: { not: null }, payFrequency: "WEEKLY_ISO" } });
  for (const employee of employees) {
    if (!employee.email || !employee.weeklyEmailEnabledAt) continue;
    const week = weeklyEmailDue(now, employee.weeklyEmailEnabledAt, "Europe/Madrid");
    if (!week) continue;
    await prisma.weeklyPayrollEmail.upsert({ where: { employeeId_weekStart: { employeeId: employee.id, weekStart: new Date(week.startDate) } }, update: {}, create: { employeeId: employee.id, weekStart: new Date(week.startDate), weekEnd: new Date(week.endDate), recipient: employee.email } });
  }
  // An interrupted SMTP submission is ambiguous. Never blindly resend salary email.
  await prisma.weeklyPayrollEmail.updateMany({ where: { status: "SENDING", lockedUntil: { lt: now } }, data: { status: "REVIEW_REQUIRED", lockedUntil: null, lastError: "INTERRUPTED_SMTP_CONFIRM_DELIVERY_BEFORE_RETRY" } });
  const pending = await prisma.weeklyPayrollEmail.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: now }, employee: { weeklyEmailEnabled: true } }, take: 10, orderBy: { createdAt: "asc" }, include: { employee: true } });
  for (const job of pending) {
    const config = mailConfig();
    if (!config) {
      await prisma.weeklyPayrollEmail.update({ where: { id: job.id }, data: { lastError: "SMTP_CONFIG_MISSING", nextAttemptAt: new Date(now.getTime() + 300000) } }); continue;
    }
    const claim = await prisma.weeklyPayrollEmail.updateMany({ where: { id: job.id, status: "PENDING", OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] }, data: { lockedUntil: new Date(now.getTime() + 300000), attempts: { increment: 1 } } });
    if (!claim.count) continue;
    let submitted = false;
    try {
      // Use the current verified employee address, never a stale reassigned recipient.
      if (!job.employee.email) throw new Error("EMPLOYEE_EMAIL_MISSING");
      const { payPeriodId } = await generatePayPeriodForEmployee({ employeeId: job.employeeId, anchorDate: job.weekEnd.toISOString().slice(0, 10) as IsoDate, frequency: "WEEKLY_ISO" });
      const content = await getReceiptContent(payPeriodId, "es");
      const pdf = await renderReceiptPdf(content);
      const start = job.weekStart.toISOString().slice(0, 10), end = job.weekEnd.toISOString().slice(0, 10);
      const amount = new Intl.NumberFormat("es-ES", { style: "currency", currency: content.employeeCurrency }).format(content.totals.netPayCents / 100);
      const messageId = `<homehero-weekly-${job.id}@${new URL(process.env.APP_ORIGIN?.split(",")[0] || "https://homehero.local").hostname}>`;
      const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, requireTLS: config.port !== 465, auth: { user: config.user, pass: config.pass }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 });
      await prisma.weeklyPayrollEmail.update({ where: { id: job.id }, data: { status: "SENDING", payPeriodId, recipient: job.employee.email, messageId } });
      submitted = true;
      const result = await transporter.sendMail({ from: { name: process.env.NOTIFY_FROM_NAME || "HomeHero", address: config.from }, to: job.employee.email, messageId,
        subject: `Recibo semanal | ${start} - ${end}`,
        text: `Hola ${job.employee.firstName},\n\nAdjuntamos el detalle de tu retribución de la semana ${start} - ${end}.\nJornadas computadas: ${content.totals.validDays}\nImporte neto de la semana: ${amount}\n\nEl PDF incluye las jornadas, la retribución, los movimientos y el saldo de deuda registrados. Puedes descargar también tus recibos anteriores desde el portal.\n\nHomeHero`,
        attachments: [{ filename: `HomeHero-recibo-${start}-${end}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
      });
      if (!result.accepted.length) throw new Error("SMTP_NOT_ACCEPTED");
      await prisma.weeklyPayrollEmail.update({ where: { id: job.id }, data: { status: "SENT", sentAt: new Date(), lockedUntil: null, lastError: null } });
    } catch {
      await prisma.weeklyPayrollEmail.updateMany({ where: { id: job.id }, data: { status: submitted ? "REVIEW_REQUIRED" : job.attempts >= 7 ? "FAILED" : "PENDING", lastError: submitted ? "SMTP_DELIVERY_UNCONFIRMED" : "PDF_PREPARATION_FAILED", lockedUntil: null, nextAttemptAt: new Date(now.getTime() + 300000) } });
    }
  }
}
