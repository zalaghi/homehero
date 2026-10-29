import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { assertSameOrigin } from "@/server/security/csrf";
import { requireAdmin } from "@/server/auth/requireAdmin";
import { revokeSessionById } from "@/server/auth/session";
import { logAudit } from "@/server/audit/log";

async function requireAdminOr401() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  const sessions = await prisma.session.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      role: s.user.role,
      email: s.user.email,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString() ?? null,
      lastSeenAt: s.lastSeenAt.toISOString(),
      ip: s.ip,
      userAgent: s.userAgent,
    })),
  });
}

const Body = z.object({ sessionId: z.string().min(10) });

export async function POST(req: Request) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const ok = await revokeSessionById(parsed.data.sessionId);
  await logAudit({
    actorUserId: user.userId,
    actorRole: user.role,
    action: ok ? "SESSION_REVOKE" : "SESSION_REVOKE_NOOP",
    entityType: "SESSION",
    entityId: parsed.data.sessionId,
    ip,
    userAgent,
  });

  return NextResponse.json({ ok });
}
