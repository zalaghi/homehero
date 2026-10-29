import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { validReceiptToken } from "@/server/notifications/receiptToken";
import { assertSameOrigin } from "@/server/security/csrf";
const Body = z.object({ deliveryId: z.string().max(64), token: z.string().max(128), event: z.enum(["displayed", "clicked"]) });
export async function POST(req: Request) {
  await assertSameOrigin();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !validReceiptToken(parsed.data.deliveryId, parsed.data.token)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { deliveryId, event } = parsed.data;
  await getPrisma().notificationDelivery.updateMany({ where: { id: deliveryId, createdAt: { gt: new Date(Date.now() - 7 * 86400000) } }, data: event === "clicked" ? { clickedAt: new Date() } : { receivedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
