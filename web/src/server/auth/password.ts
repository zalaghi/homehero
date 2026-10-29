import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  // Reasonable defaults for server-side Argon2id
  algorithm: 2, // Argon2id
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10) throw new Error("Password too short (min 10 chars)");
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashStr: string, password: string): Promise<boolean> {
  return verify(hashStr, password, ARGON2_OPTIONS);
}

