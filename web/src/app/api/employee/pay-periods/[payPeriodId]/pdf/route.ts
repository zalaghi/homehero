import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { getReceiptContent, renderReceiptPdf } from "@/server/payroll/receipt";
export async function GET(_req: Request, ctx: { params: Promise<{ payPeriodId: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "EMPLOYEE" || !user.employeeId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { payPeriodId } = await ctx.params;
  const period = await getPrisma().payPeriod.findFirst({ where: { id: payPeriodId, employeeId: user.employeeId! }, select: { id: true, startDate: true, endDate: true } });
  if (!period) return Response.json({ error: "Not found" }, { status: 404 });
  const bytes = await renderReceiptPdf(await getReceiptContent(period.id, "es"));
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="HomeHero-${period.startDate.toISOString().slice(0,10)}-${period.endDate.toISOString().slice(0,10)}.pdf"`, "Cache-Control": "private, no-store" } });
}
