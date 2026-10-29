import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import {
  createSessionRecord,
  getSessionCookieName,
  getSessionCookieOptionsForRequest,
} from "@/server/auth/session";
import { getOtpProvider } from "@/server/otp/providerFactory";
import { assertSameOrigin } from "@/server/security/csrf";
import {
  checkLockout,
  clearFailures,
  rateLimitFixedWindow,
  recordFailureAndMaybeLock,
} from "@/server/security/rateLimit";
import { logAudit } from "@/server/audit/log";
import { normalizeEmail } from "@/lib/email";

const Body = z.object({
  email: z.string().email().max(254),
  challengeId: z.string().min(10),
  code: z.string().regex(/^\d{4,8}$/),
});

export async function POST(req: Request) {
  await assertSameOrigin();
  const prisma = getPrisma();
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { email, challengeId, code } = parsed.data;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return NextResponse.json({ ok: false }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? null;

  const lockEmail = await checkLockout(`otp_verify:email:${normalizedEmail}`);
  const lockIp = await checkLockout(`otp_verify:ip:${ip}`);
  if (lockEmail.locked || lockIp.locked) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const rlId = await rateLimitFixedWindow({
    key: `otp_verify:email:${normalizedEmail}`,
    limit: 6,
    windowSeconds: 5 * 60,
  });
  const rlIp = await rateLimitFixedWindow({
    key: `otp_verify:ip:${ip}`,
    limit: 25,
    windowSeconds: 5 * 60,
  });
  if (!rlId.ok || !rlIp.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const provider = getOtpProvider();
  const verified = await provider.verifyCode(challengeId, code, normalizedEmail).catch(() => false);
  if (!verified) {
    await logAudit({
      action: "OTP_VERIFY_FAIL",
      ip,
      userAgent,
      metadata: { email: normalizedEmail, challengeId },
    });

    const failEmail = await recordFailureAndMaybeLock({
      key: `otp_verify:email:${normalizedEmail}`,
      limit: 4,
      windowSeconds: 5 * 60,
      lockoutSeconds: 15 * 60,
    });
    const failIp = await recordFailureAndMaybeLock({
      key: `otp_verify:ip:${ip}`,
      limit: 20,
      windowSeconds: 5 * 60,
      lockoutSeconds: 15 * 60,
    });

    const status = failEmail.locked || failIp.locked ? 429 : 401;
    return NextResponse.json({ ok: false }, { status });
  }

  const employee = await prisma.employee.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  // Anti-enumeration: keep generic error.
  if (!employee) {
    await logAudit({
      action: "OTP_VERIFY_FAIL_EMPLOYEE_MISSING",
      ip,
      userAgent,
      metadata: { email: normalizedEmail, challengeId },
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const user =
    (await prisma.authUser.findFirst({
      where: { role: "EMPLOYEE", employeeId: employee.id },
    })) ??
    (await prisma.authUser.create({
      data: {
        role: "EMPLOYEE",
        email: normalizedEmail,
        employeeId: employee.id,
      },
    }));

  // Ensure user's email stays in sync (in case employee email changed).
  if (user.email !== normalizedEmail) {
    await prisma.authUser.update({
      where: { id: user.id },
      data: { email: normalizedEmail },
    });
  }

  const { token, expiresAt } = await createSessionRecord({
    userId: user.id,
    role: "EMPLOYEE",
    employeeId: employee.id,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getSessionCookieName(), token, {
    ...(await getSessionCookieOptionsForRequest()),
    expires: expiresAt,
  });
  await clearFailures(`otp_verify:email:${normalizedEmail}`);
  await clearFailures(`otp_verify:ip:${ip}`);
  await logAudit({
    actorUserId: user.id,
    actorRole: "EMPLOYEE",
    action: "OTP_VERIFY_SUCCESS",
    ip,
    userAgent,
    metadata: { email: normalizedEmail, challengeId },
  });
  return res;
}

