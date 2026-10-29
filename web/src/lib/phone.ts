const E164_REGEX = /^\+\d{8,15}$/;

/**
 * Normalize user input into strict E.164 (+<digits>) format.
 * - Strips spaces, dashes, parentheses.
 * - Converts leading `00` into `+`.
 * - Ensures length between 8 and 15 digits (inclusive) after `+`.
 */
export function normalizePhoneE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Remove non-digit/+ characters to avoid accidental injection of separators.
  let normalized = trimmed.replace(/[^\d+]/g, "");
  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }
  if (!normalized.startsWith("+")) {
    normalized = `+${normalized}`;
  }

  if (!E164_REGEX.test(normalized)) return null;
  return normalized;
}

/**
 * Mask a phone number for display, keeping country code and last 2 digits.
 */
export function maskPhoneE164(phone: string): string {
  const normalized = normalizePhoneE164(phone) ?? phone;
  const digits = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  if (digits.length < 3) return normalized;

  let countryLen = Math.max(1, Math.min(3, digits.length - 9));
  if (digits.startsWith("1") && digits.length === 11) {
    countryLen = 1; // NANP numbers
  }

  const country = `+${digits.slice(0, countryLen)}`;
  const middle = digits.slice(countryLen, -2);
  const last = digits.slice(-2);
  return `${country}${"•".repeat(Math.max(1, middle.length))}${last}`;
}
