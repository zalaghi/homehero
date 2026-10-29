"use client";
import { useEffect } from "react";
import { supportsPush, syncPushSubscription } from "@/lib/push-client";
export default function PortalPwaSetup({ locale: _locale }: { locale: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let running = false, lastSync = 0;
    const sync = async () => {
      if (running || document.hidden || Date.now() - lastSync < 60000) return;
      running = true; lastSync = Date.now();
      try {
        const current = await navigator.serviceWorker.getRegistration(window.location.href);
        await navigator.serviceWorker.register("/sw.js", { scope: current?.scope ?? "/", updateViaCache: "none" });
        if (supportsPush() && Notification.permission === "granted") await syncPushSubscription();
      } catch { /* The notifications screen provides recovery and diagnostics. */ }
      finally { running = false; }
    };
    void sync();
    window.addEventListener("online", sync); document.addEventListener("visibilitychange", sync);
    return () => { window.removeEventListener("online", sync); document.removeEventListener("visibilitychange", sync); };
  }, []);
  return null;
}
