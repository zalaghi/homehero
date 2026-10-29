import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { generatePayPeriodForEmployee } from "@/server/payroll/generatePeriod";
import { logAudit } from "@/server/audit/log";
import type { IsoDate } from "@/lib/payroll/types";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const Body = z.object({
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: employeeId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { payPeriodId } = await generatePayPeriodForEmployee({
    employeeId,
    anchorDate: parsed.data.anchorDate as IsoDate,
  });

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "PAY_PERIOD_GENERATE",
    entityType: "PayPeriod",
    entityId: payPeriodId,
    metadata: { employeeId, anchorDate: parsed.data.anchorDate },
  });

  return NextResponse.json({ ok: true, payPeriodId });
}

