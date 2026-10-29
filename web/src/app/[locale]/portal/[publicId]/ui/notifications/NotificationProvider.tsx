"use client";
import { updateAppBadge } from "@/lib/app-badge";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: string;
  readAt: string | null;
  link: string | null;
};

type NotificationContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  unreadByType: Record<string, number>;
  loading: boolean;
  error: string | null;
  showRead: boolean;
  setShowRead: (next: boolean) => void;
  markAllRead: () => Promise<void>;
  markRead: (item: NotificationItem) => Promise<void>;
  markTypeRead: (type: "WEEKEND_REQUEST_DECISION" | "TODO_ASSIGNED" | "ESSENTIALS_UPDATED") => Promise<void>;
  refresh: (replace?: boolean) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const TEN_SECONDS = 10_000;
const CACHE_WINDOW_MS = 2_000;
const STALE_WINDOW_MS = 10_000;
const FORCE_MIN_INTERVAL_MS = 3_000;
const MAX_BACKOFF_MS = 60_000;

type PollerState = {
  interval: ReturnType<typeof setInterval> | null;
  subscribers: Set<() => void>;
};

type FetchState = {
  unread?: Promise<void> | null;
  list?: Promise<void> | null;
};

const globalForNotifications = globalThis as unknown as {
  __hhNotificationPoller?: PollerState;
  __hhNotificationFetches?: FetchState;
};

function getPollerState(): PollerState {
  if (!globalForNotifications.__hhNotificationPoller) {
    globalForNotifications.__hhNotificationPoller = {
      interval: null,
      subscribers: new Set(),
    };
  }
  return globalForNotifications.__hhNotificationPoller;
}

function getFetchState(): FetchState {
  if (!globalForNotifications.__hhNotificationFetches) {
    globalForNotifications.__hhNotificationFetches = {};
  }
  return globalForNotifications.__hhNotificationFetches;
}

function logDev(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  if (details) {
    console.debug(`[notifications] ${message}`, details);
  } else {
    console.debug(`[notifications] ${message}`);
  }
}

function ensurePoller() {
  const poller = getPollerState();
  if (poller.interval) return;
  poller.interval = setInterval(() => {
    if (document.hidden) return;
    poller.subscribers.forEach((callback) => callback());
  }, TEN_SECONDS);
  logDev("poller-started", { subscribers: poller.subscribers.size });
}

function stopPoller() {
  const poller = getPollerState();
  if (poller.interval) {
    clearInterval(poller.interval);
    poller.interval = null;
    logDev("poller-stopped");
  }
}

function registerPoller(callback: () => void) {
  const poller = getPollerState();
  poller.subscribers.add(callback);
  ensurePoller();
  logDev("subscriber-added", { subscribers: poller.subscribers.size });
}

function unregisterPoller(callback: () => void) {
  const poller = getPollerState();
  poller.subscribers.delete(callback);
  logDev("subscriber-removed", { subscribers: poller.subscribers.size });
  if (poller.subscribers.size === 0) {
    stopPoller();
  }
}

function parseRetryAfterMs(res: Response): number | null {
  const retryAfter = res.headers.get("retry-after");
  if (!retryAfter) return null;
  const retrySeconds = Number(retryAfter);
  if (!Number.isNaN(retrySeconds)) {
    return retrySeconds * 1000;
  }
  const retryDate = Date.parse(retryAfter);
  if (!Number.isNaN(retryDate)) {
    return Math.max(0, retryDate - Date.now());
  }
  return null;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("portal.notifications");
  const pathname = usePathname() ?? "";
  const isNotificationsRoute = pathname.includes("/notifications");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeReady, setBadgeReady] = useState(false);
  const [unreadByType, setUnreadByType] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRead, setShowRead] = useState(false);
  const inflightUnreadRef = useRef(false);
  const inflightListRef = useRef(false);
  const unreadAbortRef = useRef<AbortController | null>(null);
  const listAbortRef = useRef<AbortController | null>(null);
  const pollerCountRef = useRef(0);
  const authExpiredRef = useRef(false);
  const lastUnreadAtRef = useRef(0);
  const lastListAtRef = useRef(0);
  const lastCreatedAtRef = useRef<string | null>(null);
  const backoffUntilRef = useRef(0);
  const backoffMsRef = useRef(0);
  const pollerCallbackRef = useRef<() => void>(() => {});
  const lastForceAtRef = useRef({ unread: 0, list: 0 });
  const lastShowReadRef = useRef(showRead);

  const shouldBackoff = () => Date.now() < backoffUntilRef.current;

  const shouldAllowForce = (key: "unread" | "list") => {
    const now = Date.now();
    if (now - lastForceAtRef.current[key] < FORCE_MIN_INTERVAL_MS) return false;
    lastForceAtRef.current[key] = now;
    return true;
  };

  const handleUnauthorized = () => {
    if (authExpiredRef.current) return;
    authExpiredRef.current = true;
    setError(t("errors.sessionExpired"));
    setLoading(false);
    stopPoller();
    unreadAbortRef.current?.abort();
    listAbortRef.current?.abort();
  };

  const applyBackoff = (retryMs?: number | null) => {
    const nextBackoff = Math.min(
      MAX_BACKOFF_MS,
      Math.max(backoffMsRef.current ? backoffMsRef.current * 2 : TEN_SECONDS, retryMs ?? 0),
    );
    backoffMsRef.current = nextBackoff;
    backoffUntilRef.current = Date.now() + nextBackoff;
  };

  const handleRateLimit = (res: Response) => {
    if (res.status !== 429) return;
    const retryMs = parseRetryAfterMs(res);
    applyBackoff(retryMs);
  };

  const handleFailure = () => {
    applyBackoff();
  };

  const refreshUnread = useCallback(
    async (force = false, reason = "unknown") => {
      if (authExpiredRef.current || shouldBackoff()) return;
      if (force && !shouldAllowForce("unread")) {
        logDev("unread-skip-force-throttle", { reason });
        return;
      }
      const now = Date.now();
      if (!force && now - lastUnreadAtRef.current < CACHE_WINDOW_MS) return;

      const fetchState = getFetchState();
      if (fetchState.unread) {
        await fetchState.unread;
        return;
      }

      const fetchPromise = (async () => {
        inflightUnreadRef.current = true;
        logDev("unread-fetch-start", { reason });
        try {
          const url = new URL("/api/employee/notifications", window.location.origin);
          url.searchParams.set("includeRead", "false");
          url.searchParams.set("take", "1");
          unreadAbortRef.current?.abort();
          const controller = new AbortController();
          unreadAbortRef.current = controller;
          const res = await fetch(url.toString(), {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          });
          if (res.status === 401) {
            handleUnauthorized();
            return;
          }
          if (res.status === 429) {
            handleRateLimit(res);
            return;
          }
          const data = (await res.json().catch(() => null)) as
            | { unreadCount?: number; unreadByType?: Record<string, number>; error?: string }
            | null;
          if (!res.ok || !data) {
            handleFailure();
            return;
          }
          const nextCount = data.unreadCount ?? 0;
          const nextByType = data.unreadByType ?? {};
          setUnreadCount(nextCount); setBadgeReady(true);
          setUnreadByType(nextByType);
          lastUnreadAtRef.current = now;
          backoffMsRef.current = 0;
        } catch (error) {
          if ((error as { name?: string }).name === "AbortError") {
            return;
          }
          handleFailure();
        } finally {
          inflightUnreadRef.current = false;
          logDev("unread-fetch-end", { reason });
        }
      })();

      fetchState.unread = fetchPromise;
      try {
        await fetchPromise;
      } finally {
        if (fetchState.unread === fetchPromise) {
          fetchState.unread = null;
        }
      }
    },
    [],
  );

  const mergeItems = useCallback((nextItems: NotificationItem[], replace: boolean) => {
    if (replace) return nextItems;
    if (nextItems.length === 0) return null;
    const existingIds = new Set(items.map((item) => item.id));
    const merged = [...nextItems, ...items.filter((item) => !existingIds.has(item.id))];
    return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items]);

  const refreshList = useCallback(
    async (replace: boolean, reason = "unknown") => {
      if (authExpiredRef.current || shouldBackoff()) return;
      if (replace && !shouldAllowForce("list")) {
        logDev("list-skip-force-throttle", { reason });
        return;
      }
      const now = Date.now();
      if (!replace && now - lastListAtRef.current < CACHE_WINDOW_MS) return;

      const fetchState = getFetchState();
      if (fetchState.list) {
        await fetchState.list;
        return;
      }

      const fetchPromise = (async () => {
        inflightListRef.current = true;
        setLoading(true);
        setError(null);
        logDev("list-fetch-start", { reason });
        try {
          const url = new URL("/api/employee/notifications", window.location.origin);
          url.searchParams.set("includeRead", showRead ? "true" : "false");
          if (!replace && lastCreatedAtRef.current) {
            url.searchParams.set("after", lastCreatedAtRef.current);
          }
          listAbortRef.current?.abort();
          const controller = new AbortController();
          listAbortRef.current = controller;
          const res = await fetch(url.toString(), {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          });
          if (res.status === 401) {
            handleUnauthorized();
            return;
          }
          if (res.status === 429) {
            handleRateLimit(res);
            return;
          }
          const data = (await res.json().catch(() => null)) as
            | { items?: NotificationItem[]; unreadCount?: number; unreadByType?: Record<string, number>; error?: string }
            | null;
          if (!res.ok || !data?.items) {
            setError(data?.error ?? t("errors.load"));
            handleFailure();
            return;
          }
          const nextItems = data.items ?? [];
          const merged = mergeItems(nextItems, replace);
          if (merged) {
            setItems(merged);
          } else if (replace) {
            setItems([]);
          }
          const newest = nextItems[0]?.createdAt ?? lastCreatedAtRef.current;
          if (newest) lastCreatedAtRef.current = newest;
          setUnreadCount(data.unreadCount ?? 0); setBadgeReady(true);
          setUnreadByType(data.unreadByType ?? {});
          lastListAtRef.current = now;
          backoffMsRef.current = 0;
        } catch (error) {
          if ((error as { name?: string }).name === "AbortError") {
            return;
          }
          handleFailure();
        } finally {
          inflightListRef.current = false;
          setLoading(false);
          logDev("list-fetch-end", { reason });
        }
      })();

      fetchState.list = fetchPromise;
      try {
        await fetchPromise;
      } finally {
        if (fetchState.list === fetchPromise) {
          fetchState.list = null;
        }
      }
    },
    [mergeItems, showRead, t],
  );

  const refresh = useCallback(
    async (replace = true) => {
      if (authExpiredRef.current) return;
      if (isNotificationsRoute) {
        await refreshList(replace, "manual");
      } else {
        await refreshUnread(true, "manual");
      }
    },
    [isNotificationsRoute, refreshList, refreshUnread],
  );

  const markAllRead = useCallback(async () => {
    setError(null);
    unreadAbortRef.current?.abort();
    listAbortRef.current?.abort();
    try {
      const res = await fetch("/api/employee/notifications", {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        if (res.status === 429) handleRateLimit(res);
        setError(t("errors.update"));
        return;
      }
      setItems((prev) =>
        showRead ? prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })) : [],
      );
      setUnreadCount(0);
      setUnreadByType({});
      await refresh(true);
    } catch { setError(t("errors.update")); }
  }, [refresh, showRead, t]);

  const markRead = useCallback(
    async (item: NotificationItem) => {
      setError(null);
      const res = await fetch(`/api/employee/notifications/${item.id}`, {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clicked: true }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        if (res.status === 429) handleRateLimit(res);
        setError(t("errors.update"));
        return;
      }
      setItems((prev) =>
        showRead
          ? prev.map((entry) =>
              entry.id === item.id ? { ...entry, readAt: entry.readAt ?? new Date().toISOString() } : entry,
            )
          : prev.filter((entry) => entry.id !== item.id),
      );
      if (!item.readAt) {
        setUnreadByType((prev) => {
          const next = { ...prev };
          if (next[item.type]) {
            next[item.type] = Math.max(0, next[item.type] - 1);
          }
          return next;
        });
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      await refresh(false);
    },
    [refresh, showRead, t],
  );

  const markTypeRead = useCallback(
    async (type: "WEEKEND_REQUEST_DECISION" | "TODO_ASSIGNED" | "ESSENTIALS_UPDATED") => {
      if (!unreadByType[type]) return;
      const res = await fetch("/api/employee/notifications", {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        if (res.status === 429) handleRateLimit(res);
        return;
      }
      setUnreadByType((prev) => {
        const next = { ...prev, [type]: 0 };
        const total = Object.values(next).reduce((sum, value) => sum + value, 0);
        setUnreadCount(total);
        return next;
      });
    },
    [unreadByType],
  );

  useEffect(() => {
    if (isNotificationsRoute) return;
    void refreshUnread(true, "mount");
  }, [isNotificationsRoute, refreshUnread]);

  useEffect(() => {
    if (!isNotificationsRoute) return;
    const now = Date.now();
    const showReadChanged = lastShowReadRef.current !== showRead;
    lastShowReadRef.current = showRead;
    if (!showReadChanged && now - lastListAtRef.current < STALE_WINDOW_MS) {
      logDev("list-skip-stale", { reason: "navigation" });
      return;
    }
    listAbortRef.current?.abort();
    void refreshList(true, showReadChanged ? "show-read-toggle" : "navigation");
  }, [isNotificationsRoute, refreshList, showRead]);

  useEffect(() => {
    if (!isNotificationsRoute) {
      listAbortRef.current?.abort();
    }
  }, [isNotificationsRoute]);

  useEffect(() => {
    pollerCallbackRef.current = () => {
      if (authExpiredRef.current) return;
      void (async () => {
        if (isNotificationsRoute) {
          await refreshList(false, "timer");
          return;
        }
        await refreshUnread(false, "timer");
      })();
    };
  }, [isNotificationsRoute, refreshList, refreshUnread]);

  useEffect(() => {
    if (authExpiredRef.current) {
      stopPoller();
      return;
    }
    const callback = () => pollerCallbackRef.current();
    registerPoller(callback);
    pollerCountRef.current += 1;
    logDev("provider-mounted", { count: pollerCountRef.current });

    return () => {
      unregisterPoller(callback);
      unreadAbortRef.current?.abort();
      listAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "HOMEHERO_NOTIFICATION") void refresh();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [refresh]);

  useEffect(() => {
    if (badgeReady) void updateAppBadge(unreadCount);
  }, [unreadCount, badgeReady]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unreadCount,
      unreadByType,
      loading,
      error,
      showRead,
      setShowRead,
      markAllRead,
      markRead,
      markTypeRead,
      refresh,
    }),
    [
      error,
      items,
      loading,
      markAllRead,
      markRead,
      markTypeRead,
      refresh,
      showRead,
      unreadByType,
      unreadCount,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
