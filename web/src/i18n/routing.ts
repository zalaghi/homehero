export const locales = ["en", "es", "fa", "de"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export function isRtlLocale(locale: string): boolean {
  return locale === "fa";
}
