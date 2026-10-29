import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { getPrisma } from "@/server/db/prisma";
import type { OtpProvider, OtpSendContext, OtpSendResult } from "./types";

function otpPepper(): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) throw new Error("Missing OTP_PEPPER");
  return pepper;
}

function randomCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtpCode(input: { challengeId: string; recipient: string; code: string }): string {
  return crypto
    .createHmac("sha256", otpPepper())
    .update(`${input.challengeId}:${input.recipient.toLowerCase()}:${input.code}`)
    .digest("base64");
}

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.OTP_FROM_EMAIL ?? process.env.SMTP_USER;
  const fromName = process.env.OTP_FROM_NAME ?? "OTP";

  if (!host || !user || !pass || !fromEmail) {
    throw new Error("Missing SMTP_* or OTP_FROM_* env vars");
  }

  return { host, port, user, pass, fromEmail, fromName };
}

export class SmtpOtpProvider implements OtpProvider {
  name: OtpProvider["name"] = "SMTP";

  async sendCode(recipient: string, ctx: OtpSendContext): Promise<OtpSendResult> {
    const prisma = getPrisma();
    const email = recipient.trim().toLowerCase();
    const code = randomCode();

    const challenge = await prisma.otpChallenge.create({
      data: {
        provider: "SMTP",
        recipient: email,
        devCodeHash: "pending",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        contextJson: JSON.stringify(ctx),
      },
    });

    const codeHash = hashOtpCode({ challengeId: challenge.id, recipient: email, code });
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { devCodeHash: codeHash },
    });

    const { host, port, user, pass, fromEmail, fromName } = smtpConfig();
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
    });

    const subject = ctx.locale === "fa" ? "کد ورود" : "Your login code";
    const text =
      ctx.locale === "fa"
        ? `کد یکبار مصرف ورود شما: ${code}\n\nاین کد تا ۵ دقیقه معتبر است.\n`
        : `Your one-time login code is: ${code}\n\nThis code expires in 5 minutes.\n`;

    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject,
      text,
    });

    return { challengeId: challenge.id };
  }

  async verifyCode(challengeId: string, code: string, recipient: string): Promise<boolean> {
    const prisma = getPrisma();
    const ch = await prisma.otpChallenge.findUnique({ where: { id: challengeId } });
    if (!ch || ch.recipient.trim().toLowerCase() !== recipient.trim().toLowerCase()) return false;
    if (ch.provider !== "SMTP" || ch.attempts >= 6) return false;
    if (ch.lockedUntil && ch.lockedUntil.getTime() > Date.now()) return false;
    if (ch.expiresAt.getTime() <= Date.now()) return false;

    const expected = ch.devCodeHash ?? "";
    const actual = hashOtpCode({ challengeId, recipient: ch.recipient, code });

    const ok =
      expected.length === actual.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));

    if (ok) {
      const consumed = await prisma.otpChallenge.deleteMany({ where: { id: challengeId, expiresAt: { gt: new Date() }, attempts: { lt: 6 } } });
      return consumed.count === 1;
    }

    const attempts = (ch.attempts ?? 0) + 1;
    const lock = attempts >= 6 ? new Date(Date.now() + 10 * 60 * 1000) : null;
    await prisma.otpChallenge.updateMany({
      where: { id: challengeId },
      data: { attempts: { increment: 1 }, lockedUntil: lock },
    });
    return false;
  }
}

