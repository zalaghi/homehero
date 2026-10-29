import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { assertSameOrigin } from "@/server/security/csrf";
import { rateLimitFixedWindow } from "@/server/security/rateLimit";

async function requireEmployeeOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) return null;
  return user;
}

function rateLimitResponse(resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfterSeconds.toString(),
      },
    },
  );
}

const Body = z
  .object({
    clicked: z.boolean().optional(),
  })
  .optional();

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireEmployeeOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateLimit = await rateLimitFixedWindow({
    key: `employee:notifications:patch:${user.employeeId}`,
    limit: 120,
    windowSeconds: 60,
  });
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt);

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const prisma = getPrisma();
  const notif = await prisma.employeeNotification.findUnique({
    where: { id },
    select: { id: true, employeeId: true },
  });
  if (!notif || notif.employeeId !== user.employeeId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const clickedAt = parsed.data?.clicked ? new Date() : undefined;
  await prisma.employeeNotification.update({
    where: { id: notif.id },
    data: {
      readAt: new Date(),
      ...(clickedAt ? { clickedAt } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
