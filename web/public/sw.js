/* HomeHero v3: notification delivery is independent of an open browser tab. */
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
function safeUrl(value) {
  try { const u = new URL(value || "/en/portal", self.location.origin); return u.origin === self.location.origin ? u.href : self.location.origin + "/en/portal"; }
  catch { return self.location.origin + "/en/portal"; }
}
async function receipt(data, event) {
  if (!data.deliveryId || !data.receiptToken) return;
  try { await fetch("/api/push/receipt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deliveryId: data.deliveryId, token: data.receiptToken, event }) }); } catch {}
}
async function updateBadge(count) {
  if (!Number.isSafeInteger(count) || count < 0) return;
  try {
    if (count === 0 && self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
    else if (self.navigator.setAppBadge) await self.navigator.setAppBadge(count);
  } catch {}
}
async function refreshBadge(fallbackCount) {
  if (!("setAppBadge" in self.navigator)) return;
  await updateBadge(fallbackCount);
  // Refresh after showing the alert so delayed pushes cannot leave a stale count.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("/api/employee/notifications?includeRead=false&take=1", { cache: "no-store", signal: controller.signal });
    if (response.ok) await updateBadge((await response.json()).unreadCount);
  } catch {} finally { clearTimeout(timeout); }
}
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || "" }; }
  if (!data || typeof data !== "object") data = {};
  event.waitUntil((async () => {
    await self.registration.showNotification(data.title || "HomeHero", {
      body: data.body || "You have a new notification.", icon: "/pwa/icon-192.png", badge: "/pwa/icon-192.png",
      tag: data.notificationId || undefined, data: { ...data, url: safeUrl(data.url) },
    });
    await Promise.all([receipt(data, "displayed"), refreshBadge(data.unreadCount)]);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    windows.forEach(client => client.postMessage({ type: "HOMEHERO_NOTIFICATION" }));
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil((async () => {
    await receipt(data, "clicked");
    const url = safeUrl(data.url);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && new URL(client.url).pathname.includes("/portal")) {
        await client.navigate(url); await client.focus(); return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
self.addEventListener("pushsubscriptionchange", event => {
  event.waitUntil((async () => {
    try {
      const config = await fetch("/api/employee/push-config").then(res => res.json());
      if (!config.publicKey) return;
      const raw = atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from(raw, c => c.charCodeAt(0));
      const sub = event.newSubscription || await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await fetch("/api/employee/push-subscriptions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    } catch { /* Repaired the next time the signed-in portal is opened. */ }
  })());
});
