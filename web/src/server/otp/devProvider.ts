import crypto from "node:crypto";
import { nanoid } from "nanoid";
import type { OtpProvider, OtpSendContext, OtpSendResult } from "./types";

type DevChallenge = {
  recipient: string;
  codeHash: string;
  expiresAt: number;
};

const mem = new Map<string, DevChallenge>();

function otpPepper(): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) throw new Error("Missing OTP_PEPPER");
  return pepper;
}

export function hashOtpCode(input: {
  challengeId: string;
  recipient: string;
  code: string;
}): string {
  return crypto
    .createHmac("sha256", otpPepper())
    .update(`${input.challengeId}:${input.recipient.toLowerCase()}:${input.code}`)
    .digest("base64");
}

function randomCode(): string {
  // 6-digit numeric OTP
  return String(crypto.randomInt(100000, 1000000));
}

export class DevOtpProvider implements OtpProvider {
  name: OtpProvider["name"] = "DEV";

  async sendCode(recipient: string, ctx: OtpSendContext): Promise<OtpSendResult> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DevOtpProvider is disabled in production");
    }
    if (process.env.OTP_DEV_ALLOWED !== "true") {
      throw new Error("DevOtpProvider is disabled (OTP_DEV_ALLOWED!=true)");
    }

    const challengeId = nanoid();
    const code = randomCode();

    const codeHash = hashOtpCode({ challengeId, recipient, code });
    mem.set(challengeId, {
      recipient,
      codeHash,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // IMPORTANT: Only for development. Never show OTP to the browser.
    console.log(
      `[DEV OTP] recipient=${recipient} code=${code} challengeId=${challengeId} locale=${ctx.locale}`,
    );

    return { challengeId };
  }

  async verifyCode(challengeId: string, code: string, recipient: string): Promise<boolean> {
    const ch = mem.get(challengeId);
    if (!ch || ch.recipient.trim().toLowerCase() !== recipient.trim().toLowerCase()) return false;
    if (Date.now() > ch.expiresAt) return false;
    const expected = ch.codeHash;
    const actual = hashOtpCode({ challengeId, recipient: ch.recipient, code });
    const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
    if (ok) mem.delete(challengeId);
    return ok;
  }
}

