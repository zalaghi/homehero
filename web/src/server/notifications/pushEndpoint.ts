export function isTrustedPushEndpoint(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
    return u.hostname === "fcm.googleapis.com" || u.hostname === "android.googleapis.com" ||
      u.hostname === "updates.push.services.mozilla.com" || u.hostname.endsWith(".push.services.mozilla.com") ||
      u.hostname.endsWith(".push.apple.com") || u.hostname.endsWith(".notify.windows.com");
  } catch { return false; }
}
