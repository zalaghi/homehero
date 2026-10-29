const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;

export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > 254) return null;
  return EMAIL_REGEX.test(trimmed) ? trimmed : null;
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email) ?? email;
  const [local, domain] = normalized.split("@");
  if (!domain) return normalized;

  if (local.length <= 2) {
    return `${local.charAt(0)}•@${domain}`;
  }

  const maskedLocal = `${local.charAt(0)}${"•".repeat(Math.max(1, local.length - 2))}${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}
