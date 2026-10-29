import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { getPrisma } from "@/server/db/prisma";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "pam_session";
const REFRESH_TTL_DAYS = Number(process.env.SESSION_REFRESH_TTL_DAYS ?? "30");

function sha256Base64Url(input: string): string {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

async function clientInfo(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;
  return { ip, userAgent };
}

export type SessionUser = {
  userId: string;
  role: "ADMIN" | "EMPLOYEE";
  employeeId?: string | null;
};

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax" | "none";
  path: "/";
  domain?: string;
};

function resolveSameSite(): SessionCookieOptions["sameSite"] {
  const env = process.env.SESSION_COOKIE_SAMESITE?.toLowerCase();
  if (env === "none") return "none";
  return "lax";
}

function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

async function resolveCookieDomain(): Promise<string | undefined> {
  const envDomain = process.env.SESSION_COOKIE_DOMAIN?.trim();
  if (envDomain) return envDomain;

  const h = await headers();
  const hostHeader = h.get("x-forwarded-host") ?? h.get("host");
  if (!hostHeader) return undefined;
  const host = hostHeader.split(",")[0]?.trim().split(":")[0]?.toLowerCase();
  if (!host || host === "localhost" || isIpAddress(host)) return undefined;
  const parts = host.split(".");
  if (parts.length < 2) return undefined;
  const rootDomain = parts.slice(-2).join(".");
  return `.${rootDomain}`;
}

async function baseCookieOptions(): Promise<Omit<SessionCookieOptions, "secure">> {
  const domain = await resolveCookieDomain();
  return {
    httpOnly: true,
    sameSite: resolveSameSite(),
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

export function getSessionCookieName(): string {
  return COOKIE_NAME;
}

export async function getSessionCookieOptionsForRequest(): Promise<SessionCookieOptions> {
  const baseOptions = await baseCookieOptions();
  // Explicit override if you want to force secure cookies.
  if (process.env.SESSION_COOKIE_SECURE === "true") {
    return { ...baseOptions, secure: true };
  }
  if (process.env.SESSION_COOKIE_SECURE === "false") {
    return {
      ...baseOptions,
      secure: baseOptions.sameSite === "none" ? true : false,
    };
  }

  const h = await headers();
  const xfProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (xfProto) {
    const secure = xfProto === "https" || baseOptions.sameSite === "none";
    return { ...baseOptions, secure };
  }

  const origin = h.get("origin");
  if (origin) {
    const secure = origin.startsWith("https://") || baseOptions.sameSite === "none";
    return { ...baseOptions, secure };
  }

  const defaultSecure = process.env.NODE_ENV !== "development";
  const secure = defaultSecure || baseOptions.sameSite === "none";
  return { ...baseOptions, secure };
}

export async function createSessionRecord(
  user: SessionUser,
): Promise<{ token: string; expiresAt: Date }> {
  const prisma = getPrisma();
  const token = randomToken();
  const refreshTokenHash = sha256Base64Url(token);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { ip, userAgent } = await clientInfo();

  await prisma.session.create({
    data: {
      userId: user.userId,
      refreshTokenHash,
      expiresAt,
      ip,
      userAgent,
    },
  });

  return { token, expiresAt };
}

function sessionUserFromRecord(session: {
  userId: string;
  user: { role: SessionUser["role"]; employeeId: string | null };
}): SessionUser {
  return {
    userId: session.userId,
    role: session.user.role,
    employeeId: session.user.employeeId,
  };
}

async function getActiveSessionByToken(token: string) {
  const prisma = getPrisma();
  const refreshTokenHash = sha256Base64Url(token);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  return session;
}

async function getActiveSessionFromCookie() {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getActiveSessionByToken(token);
}

export async function rotateSessionToken(token: string) {
  const prisma = getPrisma();
  const session = await getActiveSessionByToken(token);
  if (!session) return null;

  const { ip, userAgent } = await clientInfo();

  const newToken = randomToken();
  const refreshTokenHash = sha256Base64Url(newToken);
  const now = Date.now();
  const expiresAt = new Date(now + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash,
        expiresAt,
        ip,
        userAgent,
        lastSeenAt: new Date(now),
      },
    }),
  ]);

  return { session: sessionUserFromRecord(session), token: newToken, expiresAt };
}

export async function revokeSessionById(sessionId: string): Promise<boolean> {
  const prisma = getPrisma();
  const res = await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const prisma = getPrisma();
  const refreshTokenHash = sha256Base64Url(token);
  await prisma.session.updateMany({
    where: { refreshTokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const prisma = getPrisma();
  const session = await getActiveSessionFromCookie();
  if (!session) return null;

  // Touch lastSeenAt (best-effort).
  prisma.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return sessionUserFromRecord(session);
}

export function assertRole(user: SessionUser | null, role: SessionUser["role"]): SessionUser {
  if (!user || user.role !== role) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireRole(role: SessionUser["role"]): Promise<SessionUser> {
  const user = await getCurrentUser();
  return assertRole(user, role);
}
