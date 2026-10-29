"use client";
import { supportsPush, syncPushSubscription } from "@/lib/push-client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNotifications } from "../../ui/notifications/NotificationProvider";

export default function EmployeeNotifications() {
  const t = useTranslations("portal.notifications");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { items, loading, error, showRead, setShowRead, markAllRead, markRead } = useNotifications();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushActive, setPushActive] = useState(false);

  useEffect(() => {
    if (!supportsPush()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read the browser permission after hydration.
    setPermission(Notification.permission);
    if (Notification.permission === "granted") {
      void syncPushSubscription().then(setPushActive).catch(() => setPushActive(false));
    }
  }, []);

  const enableNotifications = async () => {
    if (!supportsPush() || pushLoading) { setPushError(t("pushUnavailable")); return; }
    setPushLoading(true); setPushError(null);
    try {
      // Must happen directly in a user gesture, before unrelated network requests.
      const permission = await Notification.requestPermission();
      setPermission(permission);
      if (permission !== "granted") { setPushError(t("pushDenied")); return; }
      const saved = await syncPushSubscription();
      setPushActive(saved);
      if (!saved) setPushError(t("pushSaveFailed"));
    } catch { setPushError(t("pushSaveFailed")); }
    finally { setPushLoading(false); }
  };

  const pushCard = (
    <div className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="font-medium">{t("pushTitle")}</div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("pushDescription")}</p>
      <p className="mt-2 text-xs text-zinc-500">{t("androidHelp")} {t("iosHelp")}</p>
      {permission === "unsupported" ? (
        <p className="mt-2 text-xs text-zinc-500">{t("pushUnavailable")}</p>
      ) : permission === "granted" && pushActive ? (
        <div><p className="mt-2 text-xs text-emerald-600">{t("pushEnabled")}</p><button className="mt-2 underline" disabled={pushLoading} onClick={() => void enableNotifications()}>{tCommon("refresh")}</button></div>
      ) : (
        <button
          type="button"
          className="mt-3 touch-manipulation rounded-md border border-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
          onClick={() => void enableNotifications()}
          disabled={pushLoading}
        >
          {pushLoading ? tCommon("loading") : t("pushEnable")}
        </button>
      )}
      {pushError ? <p className="mt-2 text-xs text-rose-600">{pushError}</p> : null}
    </div>
  );

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {pushCard}
        <div className="text-sm text-zinc-500">{tCommon("loading")}</div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {pushCard}
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }


  return (
    <div className="flex flex-col gap-3">
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {pushCard}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {items.length > 0 ? (
          <button
            type="button"
            className="touch-manipulation rounded-md border border-black/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            onClick={() => void markAllRead()}
          >
            {t("markAllRead")}
          </button>
        ) : (
          <span className="text-xs text-zinc-500">{t("empty")}</span>
        )}
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={showRead}
            onChange={(e) => {
              setShowRead(e.target.checked);
            }}
          />
          {t("showRead")}
        </label>
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="button"
          tabIndex={0}
          onClick={async () => {
            await markRead(item);
            if (item.link) {
              router.push(item.link);
            }
          }}
          onKeyDown={async (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              await markRead(item);
              if (item.link) {
                router.push(item.link);
              }
            }
          }}
          className={`rounded-xl border border-black/10 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/30 ${
            item.readAt ? "opacity-80" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">{item.body}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
