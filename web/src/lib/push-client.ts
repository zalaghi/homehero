export function supportsPush() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window && window.isSecureContext;
}
function keyBytes(key: string) {
  const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
let pendingSync: Promise<boolean> | null = null;
export function syncPushSubscription(): Promise<boolean> {
  pendingSync ??= performSync().finally(() => { pendingSync = null; });
  return pendingSync;
}
async function performSync(): Promise<boolean> {
  if (!supportsPush() || Notification.permission !== "granted") return false;
  const response = await fetch("/api/employee/push-config", { cache: "no-store" });
  if (!response.ok) return false;
  const { publicKey } = await response.json() as { publicKey: string | null };
  if (!publicKey) return false;
  const current = await navigator.serviceWorker.getRegistration(window.location.href);
  // Preserve installed devices and their subscriptions, including legacy locale scopes.
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: current?.scope ?? "/", updateViaCache: "none" });
  if (!registration.active) {
    await new Promise<void>((resolve, reject) => {
      const worker = registration.installing ?? registration.waiting;
      if (!worker) { reject(new Error("Service worker unavailable")); return; }
      const timeout = setTimeout(() => { worker.removeEventListener("statechange", changed); reject(new Error("Service worker activation timed out")); }, 15000);
      const changed = () => { if (worker.state === "activated") { clearTimeout(timeout); worker.removeEventListener("statechange", changed); resolve(); } };
      worker.addEventListener("statechange", changed); changed();
    });
  }
  const key = keyBytes(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  const storedKey = subscription?.options.applicationServerKey;
  if (subscription && storedKey && Array.from(new Uint8Array(storedKey)).join(",") !== Array.from(key).join(",")) {
    const old = subscription.endpoint;
    await subscription.unsubscribe();
    await fetch("/api/employee/push-subscriptions", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: old }) });
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const saved = await fetch("/api/employee/push-subscriptions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
  return saved.ok;
}
