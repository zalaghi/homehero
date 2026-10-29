"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

type SessionRow = {
  id: string;
  userId: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
};

function formatDate(locale: string, input: string | null) {
  if (!input) return "-";
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? input : date.toLocaleString(locale);
}

export default function SessionTable({ sessions }: { sessions: SessionRow[] }) {
  const t = useTranslations("admin.sessions");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const revoke = async (sessionId: string) => {
    setPendingId(sessionId);
    try {
      await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      startTransition(() => router.refresh());
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="overflow-auto rounded-xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-black/5 text-xs uppercase text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
          <tr>
            <th className="px-3 py-2">{t("table.user")}</th>
            <th className="px-3 py-2">{t("table.role")}</th>
            <th className="px-3 py-2">{t("table.created")}</th>
            <th className="px-3 py-2">{t("table.lastSeen")}</th>
            <th className="px-3 py-2">{t("table.expires")}</th>
            <th className="px-3 py-2">{t("table.ip")}</th>
            <th className="px-3 py-2">{t("table.userAgent")}</th>
            <th className="px-3 py-2">{t("table.actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10 dark:divide-white/10">
          {sessions.map((s) => {
            const revoked = Boolean(s.revokedAt);
            return (
              <tr
                key={s.id}
                className={`${revoked ? "bg-red-50/50 dark:bg-red-950/20" : ""} hover:bg-black/5 dark:hover:bg-white/5`}
              >
                <td className="px-3 py-2">
                  <div className="font-semibold">{s.email}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.userId}</div>
                </td>
                <td className="px-3 py-2 text-xs uppercase">{s.role}</td>
                <td className="px-3 py-2 text-xs">{formatDate(locale, s.createdAt)}</td>
                <td className="px-3 py-2 text-xs">{formatDate(locale, s.lastSeenAt)}</td>
                <td className="px-3 py-2 text-xs">
                  {revoked ? (
                    <span className="text-red-700 dark:text-red-300">{t("status.revoked")}</span>
                  ) : (
                    formatDate(locale, s.expiresAt)
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{s.ip ?? "-"}</td>
                <td className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 max-w-xs truncate" title={s.userAgent ?? undefined}>
                  {s.userAgent ?? "-"}
                </td>
                <td className="px-3 py-2 text-xs">
                  <button
                    className="rounded-md border border-black/10 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-white/10 dark:text-red-200 dark:hover:bg-red-950/30"
                    disabled={revoked || isPending || pendingId === s.id}
                    onClick={() => revoke(s.id)}
                  >
                    {revoked ? t("status.revoked") : tCommon("revoke")}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
