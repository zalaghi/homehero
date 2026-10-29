/** The supplied Origin must itself be trusted; a trusted destination is not evidence. */
export function isAllowedOrigin(h: Pick<Headers, "get">, configured = process.env.APP_ORIGIN): boolean {
  const origin = h.get("origin");
  if (!origin) return h.get("sec-fetch-site") !== "cross-site";
  if (origin === "null") return false;
  const allowed = (configured ?? "").split(",").map(v => v.trim()).filter(Boolean);
  if (allowed.length) return allowed.includes(origin);
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() ?? h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  return !!host && origin === `${proto}://${host}`;
}
