import { isTrustedPushEndpoint } from "@/server/notifications/pushEndpoint";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
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

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine(isTrustedPushEndpoint),
  expirationTime: z.number().int().min(0).max(8640000000000000).nullable().optional(),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/),
  }),
});

export async function POST(req: Request) {
  try { await assertSameOrigin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const user = await requireEmployeeOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateLimit = await rateLimitFixedWindow({ key: `push:register:${user.employeeId}`, limit: 30, windowSeconds: 60 });
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt);
  const parsed = SubscriptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  const expirationTime = parsed.data.expirationTime ? new Date(parsed.data.expirationTime) : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;
  const prisma = getPrisma();
  const subscription = await prisma.$transaction(async tx => {
    // A shared browser may change accounts; never send another employee's data to it.
    await tx.employeePushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, employeeId: { not: user.employeeId! } } });
    return tx.employeePushSubscription.upsert({
      where: { employeeId_endpoint: { employeeId: user.employeeId!, endpoint: parsed.data.endpoint } },
      update: { p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, expirationTime, userAgent },
      create: { employeeId: user.employeeId!, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, expirationTime, userAgent },
    });
  });
  return NextResponse.json({ ok: true, subscriptionId: subscription.id });
}

const DeleteSchema = z.object({
  endpoint: z.string().url(),
});

export async function DELETE(req: Request) {
  await assertSameOrigin();
  const user = await requireEmployeeOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateLimit = await rateLimitFixedWindow({
    key: `employee:push-subscriptions:delete:${user.employeeId}`,
    limit: 240,
    windowSeconds: 60,
  });
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt);

  const json = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prisma = getPrisma();
  await prisma.employeePushSubscription.deleteMany({
    where: { employeeId: user.employeeId!, endpoint: parsed.data.endpoint },
  });

  return NextResponse.json({ ok: true });
}
