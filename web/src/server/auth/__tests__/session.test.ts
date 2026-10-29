import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { rotateSessionToken } from "../session";

const refreshToken = "refresh-token";
const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("base64url");

const prismaMock = {
  session: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
};

type FindUniqueArgs = {
  where: {
    refreshTokenHash: string;
  };
};

vi.mock("@/server/db/prisma", () => ({
  getPrisma: () => prismaMock,
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (key: string) => {
      if (key === "x-forwarded-for") return "203.0.113.1";
      if (key === "user-agent") return "jest-agent";
      return null;
    },
  }),
  cookies: async () => ({ get: () => ({ value: refreshToken }) }),
}));

describe("rotateSessionToken", () => {
  it("revokes the old session and issues a new token", async () => {
    prismaMock.session.findUnique.mockImplementation(async ({ where }: FindUniqueArgs) => {
      if (where.refreshTokenHash === refreshTokenHash) {
        return {
          id: "sess1",
          userId: "user1",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          revokedAt: null,
          user: { role: "ADMIN", employeeId: null },
        };
      }
      return null;
    });
    prismaMock.session.update.mockResolvedValue({ id: "sess1" });
    prismaMock.session.create.mockResolvedValue({ id: "sess2" });

    const result = await rotateSessionToken(refreshToken);

    expect(prismaMock.session.update).toHaveBeenCalledWith({
      where: { id: "sess1" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prismaMock.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user1", ip: "203.0.113.1", userAgent: "jest-agent" }),
    });
    expect(result?.session).toEqual({ userId: "user1", role: "ADMIN", employeeId: null });
    expect(result?.token).toBeDefined();
  });
});
