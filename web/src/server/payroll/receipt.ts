import PDFDocument from "pdfkit";
import { mergeAttendanceRecords } from "@/lib/attendance/merge";
import path from "node:path";
import { getHolidaySetForEmployee } from "@/server/attendance/holidayLookup";
import { listIsoDatesInclusive, isWeekendInTimeZone } from "@/lib/attendance/calendar";
import { isValidWorkedDay } from "@/lib/payroll/validWorkedDay";
import type { PayPeriodStatus } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { uploadObject, getPresignedDownloadUrl } from "@/server/storage/s3";
import type { IsoDate } from "@/lib/payroll/types";

export type ReceiptLocale = "en" | "fa" | "es" | "de";

const translations: Record<ReceiptLocale, Record<string, string>> = {
  en: {
    title: "Salary receipt",
    employee: "Employee",
    period: "Period",
    paymentDate: "Payment date",
    status: "Status",
    totals: "Totals",
    gross: "Gross pay",
    expenses: "Card expenses",
    loans: "Loans given",
    collected: "Debt collected",
    debt: "Debt",
    net: "Net pay",
    note: "Payment notes",
  },
  es: {
    title: "Recibo de salario",
    employee: "Empleado",
    period: "Período",
    paymentDate: "Fecha de pago",
    status: "Estado",
    totals: "Totales",
    gross: "Salario bruto",
    expenses: "Gastos de tarjeta",
    loans: "Préstamos entregados",
    collected: "Deuda cobrada",
    debt: "Deuda",
    net: "Pago neto",
    note: "Notas de pago",
  },
  de: {
    title: "Gehaltsbeleg",
    employee: "Mitarbeiter",
    period: "Zeitraum",
    paymentDate: "Zahlungsdatum",
    status: "Status",
    totals: "Summen",
    gross: "Bruttolohn",
    expenses: "Kartenausgaben",
    loans: "Gewährte Darlehen",
    collected: "Eingezogene Schulden",
    debt: "Schuld",
    net: "Nettolohn",
    note: "Zahlungsnotizen",
  },
  fa: {
    title: "رسید حقوق",
    employee: "کارمند",
    period: "دوره",
    paymentDate: "تاریخ پرداخت",
    status: "وضعیت",
    totals: "جمع",
    gross: "حقوق ناخالص",
    expenses: "هزینه کارت",
    loans: "وام پرداخت شده",
    collected: "بدهی دریافت شده",
    debt: "بدهی",
    net: "حقوق خالص",
    note: "یادداشت پرداخت",
  },
};

export type ReceiptContent = {
  employeeName: string;
  employeeCurrency: string;
  locale: ReceiptLocale;
  startDate: IsoDate;
  endDate: IsoDate;
  paymentDate: IsoDate | null;
  reference?: string;
  employerName?: string;
  employerTaxId?: string;
  employerAddress?: string;
  employeeReference?: string;
  employeeTaxId?: string;
  days?: Array<{ date: IsoDate; worked: boolean; counted: boolean; holiday: boolean; weekend: boolean }>;

  movements?: Array<{ date: IsoDate; description: string; amountCents: number; kind: "expense" | "loan" | "collection" }>;
  status: PayPeriodStatus;
  note?: string | null;
  totals: {
    validDays: number;
    dailyRateCents: number;
    grossPayCents: number;
    cardExpensesCents: number;
    loansCents: number;
    debtCollectedCents: number;
    debtStartCents: number;
    debtEndCents: number;
    netPayCents: number;
  };
};

function fmtDate(date: IsoDate, locale: ReceiptLocale): string {
  const d = new Date(`${date}T00:00:00Z`);
  const fmt =
    locale === "fa"
      ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "long" })
      : new Intl.DateTimeFormat(locale, { dateStyle: "long" });
  return fmt.format(d);
}

function fmtMoney(amountCents: number, currency: string, locale: ReceiptLocale): string {
  try {
    return new Intl.NumberFormat(locale === "fa" ? "fa" : locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

export function buildReceiptLines(input: ReceiptContent): string[] {
  const t = translations[input.locale];
  const lines: string[] = [];
  lines.push(t.title);
  lines.push(`${t.employee}: ${input.employeeName}`);
  lines.push(`${t.period}: ${fmtDate(input.startDate, input.locale)} → ${fmtDate(input.endDate, input.locale)}`);
  if (input.paymentDate) lines.push(`${t.paymentDate}: ${fmtDate(input.paymentDate, input.locale)}`);
  lines.push(`${t.status}: ${input.status}`);
  lines.push(`${t.totals}:`);
  lines.push(`• ${t.gross}: ${fmtMoney(input.totals.grossPayCents, input.employeeCurrency, input.locale)}`);
  lines.push(`• ${t.expenses}: ${fmtMoney(input.totals.cardExpensesCents, input.employeeCurrency, input.locale)}`);
  lines.push(`• ${t.loans}: ${fmtMoney(input.totals.loansCents, input.employeeCurrency, input.locale)}`);
  lines.push(`• ${t.collected}: ${fmtMoney(input.totals.debtCollectedCents, input.employeeCurrency, input.locale)}`);
  lines.push(
    `• ${t.debt}: ${fmtMoney(input.totals.debtStartCents, input.employeeCurrency, input.locale)} → ${fmtMoney(input.totals.debtEndCents, input.employeeCurrency, input.locale)}`,
  );
  lines.push(`• ${t.net}: ${fmtMoney(input.totals.netPayCents, input.employeeCurrency, input.locale)}`);
  if (input.note) lines.push(`${t.note}: ${input.note}`);
  return lines;
}

const documentLabels = {
  es: { title: "RECIBO DE RETRIBUCIONES", subtitle: "Liquidación semanal · Servicio del hogar · España", employer: "EMPLEADOR/A", worker: "PERSONA TRABAJADORA", reference: "Referencia", paid: "Pago registrado", pending: "Resumen de la semana", work: "DETALLE DE JORNADAS", date: "Fecha", day: "Día", attendance: "Registro", worked: "Trabajado", extra: "Extra autorizado", holiday: "Festivo", rest: "Sin jornada", wage: "RETRIBUCIÓN Y MOVIMIENTOS", concept: "Concepto", units: "Unidades", rate: "Tarifa", amount: "Importe", base: "Retribución por jornadas", net: "IMPORTE NETO DE LA SEMANA", debt: "CONTROL DE DEUDA", opening: "Saldo anterior", closing: "Saldo pendiente", notes: "OBSERVACIONES", footer: "Resumen interno de retribución. No incluye cálculo de cotizaciones ni retenciones.", method: "Forma prevista: retirada de efectivo en cajero.", days: "jornadas", period: "PERÍODO DE LIQUIDACIÓN", id: "Identificación" },
  en: { title: "WEEKLY PAY STATEMENT", subtitle: "Weekly settlement · Household services · Spain", employer: "EMPLOYER", worker: "EMPLOYEE", reference: "Reference", paid: "Payment recorded", pending: "Weekly statement", work: "WORKED DAYS", date: "Date", day: "Day", attendance: "Record", worked: "Worked", extra: "Approved extra", holiday: "Holiday", rest: "No work recorded", wage: "PAY AND TRANSACTIONS", concept: "Description", units: "Units", rate: "Rate", amount: "Amount", base: "Pay for worked days", net: "NET AMOUNT FOR THE WEEK", debt: "DEBT BALANCE", opening: "Opening balance", closing: "Remaining balance", notes: "NOTES", footer: "Internal pay statement. Social contributions and tax withholding are not calculated.", method: "Planned method: cash withdrawal at an ATM.", days: "days", period: "PAY PERIOD", id: "Identification" },
  de: { title: "WÖCHENTLICHE ABRECHNUNG", subtitle: "Wochenabrechnung · Haushaltshilfe · Spanien", employer: "ARBEITGEBER", worker: "MITARBEITER", reference: "Referenz", paid: "Zahlung erfasst", pending: "Wochenübersicht", work: "ARBEITSTAGE", date: "Datum", day: "Tag", attendance: "Eintrag", worked: "Gearbeitet", extra: "Genehmigte Zusatzarbeit", holiday: "Feiertag", rest: "Kein Arbeitstag", wage: "VERGÜTUNG UND BUCHUNGEN", concept: "Beschreibung", units: "Einheiten", rate: "Satz", amount: "Betrag", base: "Vergütung für Arbeitstage", net: "NETTOBETRAG DER WOCHE", debt: "SCHULDENSALDO", opening: "Anfangssaldo", closing: "Restbetrag", notes: "ANMERKUNGEN", footer: "Interne Abrechnung ohne Berechnung von Sozialabgaben und Steuern.", method: "Geplante Methode: Bargeldabhebung am Automaten.", days: "Tage", period: "ABRECHNUNGSZEITRAUM", id: "Kennung" },
  fa: { title: "رسید حقوق", subtitle: "تسویه هفتگی - خدمات منزل - اسپانیا", employer: "کارفرما", worker: "کارمند", reference: "شماره", paid: "پرداخت ثبت شده", pending: "گزارش هفته", work: "جزئیات روزهای کار", date: "تاریخ", day: "روز", attendance: "وضعیت", worked: "کارکرد", extra: "اضافه کار تأیید شده", holiday: "تعطیل", rest: "بدون کارکرد", wage: "حقوق و گردش حساب", concept: "شرح", units: "تعداد", rate: "نرخ", amount: "مبلغ", base: "دستمزد روزهای کار", net: "مبلغ خالص هفته", debt: "مانده بدهی", opening: "مانده قبل", closing: "مانده بعد", notes: "توضیحات", footer: "گزارش داخلی دستمزد است. مالیات و بیمه محاسبه نشده است.", method: "روش پیش بینی شده: برداشت نقدی از خودپرداز", days: "روز", period: "دوره حساب", id: "شناسه" },
} as const;

export async function renderReceiptPdf(input: ReceiptContent): Promise<Uint8Array> {
  const l = documentLabels[input.locale] ?? documentLabels.en;
  const t = translations[input.locale] ?? translations.en;
  const fonts = path.join(process.cwd(), "assets/fonts");
  const doc = new PDFDocument({ size: "A4", margins: { top: 42, left: 42, right: 42, bottom: 92 }, bufferPages: true, info: { Title: l.title, Author: input.employerName || "HomeHero", Subject: `${input.startDate} - ${input.endDate}` } });
  doc.registerFont("Regular", path.join(fonts, input.locale === "fa" ? "Arabic.ttf" : "Regular.ttf"));
  doc.registerFont("Bold", path.join(fonts, input.locale === "fa" ? "Arabic.ttf" : "Bold.ttf"));
  const chunks: Buffer[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => { doc.on("data", chunk => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const left = 42, width = 511, right = left + width, green = "#16664F", ink = "#1B2934", muted = "#65737E";
  const money = (amount: number) => fmtMoney(amount, input.employeeCurrency, input.locale);
  const text = (value: string, x: number, y: number, size = 10, bold = false, color = ink, options: PDFKit.Mixins.TextOptions = {}) => {
    doc.font(bold ? "Bold" : "Regular").fontSize(size).fillColor(color).text(value, x, y, { width: width, lineGap: 2, ...options });
  };
  doc.rect(0, 0, 595.28, 8).fill(green);
  text("HOMEHERO", left, 29, 12, true, green);
  text(`${l.reference}: ${input.reference || input.startDate.replaceAll("-", "")}`, 345, 30, 8, false, muted, { width: 208, align: "right" });
  text(l.title, left, 61, 23, true);
  text(l.subtitle, left, 92, 9, false, muted);
  doc.roundedRect(left, 119, width, 65, 7).fill("#F1F6F4");
  text(l.period, left + 14, 132, 8, true, green);
  const shortDate = (date: string) => new Intl.DateTimeFormat(input.locale === "fa" ? "fa-IR" : `${input.locale}-${input.locale === "en" ? "GB" : input.locale.toUpperCase()}`, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
  text(`${shortDate(input.startDate)}  -  ${shortDate(input.endDate)}`, left + 14, 151, 13, true, ink, { width: 300 });
  text(input.status === "PAID" ? l.paid : l.pending, 360, 139, 10, true, green, { width: 178, align: "right" });
  if (input.paymentDate && input.status === "PAID") text(shortDate(input.paymentDate), 360, 158, 9, false, muted, { width: 178, align: "right" });
  const hasEmployer = !!(input.employerName || input.employerTaxId || input.employerAddress);
  let employerBottom = 0;
  if (hasEmployer) {
    text(l.employer, left, 202, 8, true, green, { width: 238 });
    text(input.employerName || "-", left, 219, 11, true, ink, { width: 238 });
    const employerNameBottom = doc.y;
    text([input.employerTaxId, input.employerAddress].filter(Boolean).join("\n") || "-", left, employerNameBottom + 5, 9, false, muted, { width: 238 });
    employerBottom = doc.y;
  }
  const workerX = hasEmployer ? 315 : left, workerWidth = hasEmployer ? 238 : width;
  text(l.worker, workerX, 202, 8, true, green, { width: workerWidth });
  text(input.employeeName, workerX, 219, 11, true, ink, { width: workerWidth });
  const employeeNameBottom = doc.y;
  text(`${l.id}: ${input.employeeTaxId || input.employeeReference || "-"}`, workerX, employeeNameBottom + 5, 9, false, muted, { width: workerWidth });
  let y = Math.max(268, employerBottom + 15, doc.y + 15);
  const section = (label: string) => { text(label, left, y, 9, true, green); y += 22; };
  const newPageIfNeeded = (height: number) => {
    if (y + height > 748) {
      doc.addPage(); text("HOMEHERO", left, 28, 10, true, green);
      text(`${input.employeeName} · ${shortDate(input.startDate)} - ${shortDate(input.endDate)}`, 175, 28, 8, false, muted, { width: 378, align: "right" });
      y = 63;
    }
  };
  if (input.days?.length) {
    section(l.work);
    doc.rect(left, y, width, 23).fill("#EAF0ED");
    text(l.date, left + 10, y + 6, 8, true); text(l.day, left + 115, y + 6, 8, true); text(l.attendance, left + 280, y + 6, 8, true); y += 25;
    for (const [index, day] of input.days.entries()) {
      newPageIfNeeded(25);
      if (index % 2 === 0) doc.rect(left, y - 2, width, 17).fill("#F8FAF9");
      text(shortDate(day.date), left + 10, y + 3, 8);
      text(new Intl.DateTimeFormat(input.locale, { weekday: "long", timeZone: "UTC" }).format(new Date(day.date + "T12:00:00Z")), left + 115, y + 3, 8);
      text(day.counted ? (day.weekend || day.holiday ? l.extra : l.worked) : day.holiday ? l.holiday : l.rest, left + 280, y + 3, 8, day.counted, day.counted ? green : muted, { width: 220 });
      y += 18;
    }
    y += 12;
  }
  newPageIfNeeded(225); section(l.wage);
  doc.rect(left, y, width, 25).fill(ink);
  text(l.concept, left + 10, y + 7, 8, true, "white", { width: 250 });
  text(l.units, 315, y + 7, 8, true, "white", { width: 55, align: "right" });
  text(l.rate, 380, y + 7, 8, true, "white", { width: 65, align: "right" });
  text(l.amount, 450, y + 7, 8, true, "white", { width: 93, align: "right" }); y += 29;
  const historicalAdjustment = input.totals.netPayCents - (input.totals.grossPayCents - input.totals.cardExpensesCents - input.totals.debtCollectedCents + input.totals.loansCents);
  const adjustmentLabel = input.locale === "es" ? "Diferencia del importe histórico registrado" : input.locale === "de" ? "Differenz zum gespeicherten Betrag" : input.locale === "fa" ? "اختلاف مبلغ ثبت‌شده تاریخی" : "Difference to the recorded historical amount";
  const rows = [
    [l.base, `${input.totals.validDays}`, money(input.totals.dailyRateCents), money(input.totals.grossPayCents)],
    ...(input.totals.cardExpensesCents ? [[t.expenses, "", "", `- ${money(input.totals.cardExpensesCents)}`]] : []),
    ...(input.totals.debtCollectedCents ? [[t.collected, "", "", `- ${money(input.totals.debtCollectedCents)}`]] : []),
    ...(input.totals.loansCents ? [[t.loans, "", "", `+ ${money(input.totals.loansCents)}`]] : []),
    ...(historicalAdjustment ? [[adjustmentLabel, "", "", `${historicalAdjustment > 0 ? "+" : "-"} ${money(Math.abs(historicalAdjustment))}`]] : []),
  ];
  for (const [label, units, rate, amount] of rows) {
    text(label, left + 10, y + 7, 9, false, ink, { width: 250 });
    text(units, 315, y + 7, 9, false, ink, { width: 55, align: "right" });
    text(rate, 380, y + 7, 9, false, ink, { width: 65, align: "right" });
    text(amount, 450, y + 7, 10, true, ink, { width: 93, align: "right" });
    doc.moveTo(left, y + 21).lineTo(right, y + 21).lineWidth(.5).stroke("#E3E9E6"); y += 24;
  }
  doc.roundedRect(left, y + 3, width, 48, 6).fill(green);
  text(l.net, left + 14, y + 20, 10, true, "white", { width: 320 });
  text(money(input.totals.netPayCents), 380, y + 15, 21, true, "white", { width: 159, align: "right" }); y += 60;
  newPageIfNeeded(50);
  text(l.debt, left, y, 8, true, green); y += 17;
  text(`${l.opening}: ${money(input.totals.debtStartCents)}`, left, y, 9, false, muted, { width: 255 });
  text(`${l.closing}: ${money(input.totals.debtEndCents)}`, 300, y, 9, true, ink, { width: 253, align: "right" }); y += 23;
  if (input.movements?.length) {
    newPageIfNeeded(55);
    section(input.locale === "es" ? "DESGLOSE DE MOVIMIENTOS" : input.locale === "de" ? "BUCHUNGSDETAILS" : input.locale === "fa" ? "ریز گردش حساب" : "TRANSACTION DETAILS");
    for (const movement of input.movements) {
      const label = `${movement.kind === "expense" ? t.expenses : movement.kind === "loan" ? t.loans : t.collected}${movement.description ? ` · ${movement.description}` : ""}`;
      const height = Math.max(25, doc.font("Regular").fontSize(8).heightOfString(label, { width: 300, lineGap: 2 }) + 12);
      newPageIfNeeded(height);
      text(shortDate(movement.date), left, y + 5, 8, false, muted, { width: 85 });
      text(label, left + 90, y + 5, 8, false, ink, { width: 300 });
      text(`${movement.kind === "loan" ? "+" : "-"} ${money(movement.amountCents)}`, 440, y + 5, 9, true, ink, { width: 113, align: "right" });
      y += height;
    }
  }
  if (input.note) { newPageIfNeeded(80); text(l.notes, left, y, 8, true, green); y += 18; doc.font("Regular").fontSize(9).fillColor(muted).text(input.note, left, y, { width, lineGap: 3 }); y = doc.y + 15; }
  const pages = doc.bufferedPageRange();
  for (let n = pages.start; n < pages.start + pages.count; n++) {
    doc.switchToPage(n);
    doc.page.margins.bottom = 0;
    doc.moveTo(left, 778).lineTo(right, 778).lineWidth(.5).stroke("#D9E3DF");
    text(l.footer, left, 788, 7, false, muted, { width: 450, height: 24 });
    text(`${n+1} / ${pages.count}`, 500, 788, 7, false, muted, { width: 53, align: "right" });
  }
  doc.end(); return done;
}

export async function getReceiptContent(payPeriodId: string, requestedLocale?: ReceiptLocale): Promise<ReceiptContent> {
  const prisma = getPrisma();
  const period = await prisma.payPeriod.findUnique({ where: { id: payPeriodId }, include: { employee: true } });
  if (!period) throw new Error("Pay period not found");
  const startDate = period.startDate.toISOString().slice(0, 10) as IsoDate;
  const endDate = period.endDate.toISOString().slice(0, 10) as IsoDate;
  const [attendance, holidaySet, employer, expenses, debt] = await Promise.all([
    prisma.attendanceDay.findMany({ where: { employeeId: period.employeeId, date: { gte: period.startDate, lte: period.endDate } } }),
    getHolidaySetForEmployee({ employeeId: period.employeeId, holidayCalendarId: period.employee.holidayCalendarId, start: startDate, end: endDate }),
    prisma.appSetting.findMany({ where: { key: { in: ["payroll.employerName", "payroll.employerTaxId", "payroll.employerAddress"] } } }),
    prisma.cardExpense.findMany({ where: { employeeId: period.employeeId, date: { gte: period.startDate, lte: period.endDate } }, orderBy: { date: "asc" } }),
    prisma.debtTransaction.findMany({ where: { employeeId: period.employeeId, voidedAt: null, date: { gte: period.startDate, lte: period.endDate } }, orderBy: { date: "asc" } }),
  ]);
  const settings = new Map(employer.map(row => [row.key, row.value]));
  const records = mergeAttendanceRecords(attendance);
  const locale = requestedLocale ?? period.employee.locale as ReceiptLocale;
  return {
    employeeName: `${period.employee.firstName} ${period.employee.lastName}`, employeeCurrency: period.currency,
    employeeReference: period.employee.publicId, employerName: settings.get("payroll.employerName"), employerTaxId: settings.get("payroll.employerTaxId"), employerAddress: settings.get("payroll.employerAddress"),
    reference: `HH-${startDate.replaceAll("-", "")}-${period.id.slice(-6).toUpperCase()}`,
    locale: translations[locale] ? locale : "en", startDate, endDate,
    paymentDate: period.paidAt ? period.paidAt.toISOString().slice(0, 10) as IsoDate : null,
    status: period.status, note: period.adminNote,
    movements: [
      ...expenses.map(row => ({ date: row.date.toISOString().slice(0, 10) as IsoDate, description: row.concept, amountCents: row.amountCents, kind: "expense" as const })),
      ...debt.map(row => ({ date: row.date.toISOString().slice(0, 10) as IsoDate, description: row.note || "", amountCents: row.amountCents, kind: row.type === "LOAN_GIVEN" ? "loan" as const : "collection" as const })),
    ].sort((a, b) => a.date.localeCompare(b.date)),
    days: listIsoDatesInclusive(startDate, endDate).map(date => { const row = records.get(date); return { date, worked: !!row?.worked,
      counted: isValidWorkedDay(date, !!row?.worked, !!row?.authorizedExtra, { isHoliday: d => holidaySet.has(d), isWeekend: d => isWeekendInTimeZone(d, period.employee.timezone) }), holiday: holidaySet.has(date), weekend: isWeekendInTimeZone(date, period.employee.timezone) }; }),
    totals: { validDays: period.validDays, dailyRateCents: period.dailyRateCents, grossPayCents: period.grossPayCents, cardExpensesCents: period.cardExpensesCents, loansCents: period.loansCents, debtCollectedCents: period.debtCollectedCents, debtStartCents: period.debtStartCents, debtEndCents: period.debtEndCents, netPayCents: period.netPayCents },
  };
}

export async function generateAndStoreReceipt(args: { payPeriodId: string; locale?: ReceiptLocale }) {
  const prisma = getPrisma();
  const period = await prisma.payPeriod.findUnique({
    where: { id: args.payPeriodId },
    include: { employee: true },
  });
  if (!period) throw new Error("Pay period not found");

  const pdfBytes = await renderReceiptPdf(await getReceiptContent(args.payPeriodId, args.locale));

  const key = `receipts/${period.employeeId}/${period.id}.pdf`;
  await uploadObject({ key, contentType: "application/pdf", body: pdfBytes });
  await prisma.payPeriod.update({ where: { id: period.id }, data: { receiptFileKey: key } });
  const receiptUrl = await getPresignedDownloadUrl(key);
  return { receiptFileKey: key, receiptUrl };
}
