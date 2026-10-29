import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { assertSameOrigin } from "@/server/security/csrf";
import { z } from "zod";
const Body = z.object({ employerName: z.string().trim().max(120), employerTaxId: z.string().trim().max(40), employerAddress: z.string().trim().max(250) });
export async function PATCH(req: Request) {
  await assertSameOrigin(); const user = await getCurrentUser(); if (user?.role !== "ADMIN") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  await getPrisma().$transaction(Object.entries(parsed.data).map(([key, value]) => getPrisma().appSetting.upsert({ where: { key: `payroll.${key}` }, create: { key: `payroll.${key}`, value }, update: { value } })));
  return Response.json({ ok: true });
}
