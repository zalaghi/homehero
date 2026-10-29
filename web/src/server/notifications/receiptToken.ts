import crypto from "node:crypto";
export function receiptToken(id: string): string {
  const secret = process.env.OTP_PEPPER;
  if (!secret) throw new Error("Missing OTP_PEPPER");
  return crypto.createHmac("sha256", secret).update(`push-receipt:${id}`).digest("base64url");
}
export function validReceiptToken(id: string, token: string): boolean {
  const expected = receiptToken(id);
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
