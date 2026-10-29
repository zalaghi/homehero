import crypto from "node:crypto";

function getEncryptionKey(): Buffer {
  const base64 = process.env.APP_ENCRYPTION_KEY_BASE64;
  if (base64) {
    const key = Buffer.from(base64, "base64");
    if (key.length !== 32) {
      throw new Error("APP_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
    }
    return key;
  }

  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Missing APP_ENCRYPTION_KEY_BASE64 or APP_ENCRYPTION_KEY env var");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptString(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${ciphertext.toString("base64")}.${authTag.toString("base64")}`;
}

export function decryptString(payload: string): string {
  const [ivB64, cipherB64, tagB64] = payload.split(".");
  if (!ivB64 || !cipherB64 || !tagB64) {
    throw new Error("Invalid encrypted payload");
  }
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function maybeEncryptJson(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null;
  const json = JSON.stringify(payload);
  return encryptString(json);
}
