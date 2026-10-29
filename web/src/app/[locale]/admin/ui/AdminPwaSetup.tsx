"use client";

import { useEffect } from "react";

export default function AdminPwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let running = false;
    let lastSync = 0;
    const sync = async () => {
      if (running || document.hidden || Date.now() - lastSync < 60_000) return;
      running = true;
      lastSync = Date.now();
      try {
        // Share the existing worker without registering employee push subscriptions.
        await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      } catch {
        // A worker registration failure must not prevent sign-in.
      } finally {
        running = false;
      }
    };
    void sync();
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return null;
}
