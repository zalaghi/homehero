import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { verifyPassword } from "@/server/auth/password";
import {
  createSessionRecord,
  getSessionCookieName,
  getSessionCookieOptionsForRequest,
} from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { logAudit } from "@/server/audit/log";
import {
  checkLockout,
  clearFailures,
  rateLimitFixedWindow,
  recordFailureAndMaybeLock,
} from "@/server/security/rateLimit";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  await assertSameOrigin();
  const prisma = getPrisma();
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? null;

  const lockEmail = await checkLockout(`admin_login:email:${normalizedEmail}`);
  const lockIp = await checkLockout(`admin_login:ip:${ip}`);
  if (lockEmail.locked || lockIp.locked) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const rlEmail = await rateLimitFixedWindow({
    key: `admin_login:email:${normalizedEmail}`,
    limit: 6,
    windowSeconds: 5 * 60,
  });
  const rlIp = await rateLimitFixedWindow({
    key: `admin_login:ip:${ip}`,
    limit: 30,
    windowSeconds: 5 * 60,
  });
  if (!rlEmail.ok || !rlIp.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const user = await prisma.authUser.findUnique({ where: { email: normalizedEmail } });

  // Anti-enumeration: always do comparable work.
  const hash = user?.passwordHash ?? "$argon2id$v=19$m=19456,t=2,p=1$invalid$invalid";
  const passwordOk = await verifyPassword(hash, password).catch(() => false);

  if (!user || user.role !== "ADMIN" || !user.passwordHash || !passwordOk) {
    await logAudit({
      actorUserId: user?.id,
      actorRole: "ADMIN",
      action: "ADMIN_LOGIN_FAIL",
      ip,
      userAgent,
      metadata: { email: normalizedEmail },
    });

    const failEmail = await recordFailureAndMaybeLock({
      key: `admin_login:email:${normalizedEmail}`,
      limit: 4,
      windowSeconds: 5 * 60,
      lockoutSeconds: 15 * 60,
    });
    const failIp = await recordFailureAndMaybeLock({
      key: `admin_login:ip:${ip}`,
      limit: 20,
      windowSeconds: 5 * 60,
      lockoutSeconds: 15 * 60,
    });

    const status = failEmail.locked || failIp.locked ? 429 : 401;
    return NextResponse.json({ ok: false }, { status });
  }

  await clearFailures(`admin_login:email:${normalizedEmail}`);
  await clearFailures(`admin_login:ip:${ip}`);

  const { token, expiresAt } = await createSessionRecord({
    userId: user.id,
    role: "ADMIN",
    employeeId: null,
  });
  const res = NextResponse.json({ ok: true });
  const cookieOpts = await getSessionCookieOptionsForRequest();
  res.cookies.set(getSessionCookieName(), token, {
    ...cookieOpts,
    expires: expiresAt,
  });
  await logAudit({
    actorUserId: user.id,
    actorRole: "ADMIN",
    action: "ADMIN_LOGIN_SUCCESS",
    ip,
    userAgent,
    metadata: { email: normalizedEmail },
  });
  return res;
}

