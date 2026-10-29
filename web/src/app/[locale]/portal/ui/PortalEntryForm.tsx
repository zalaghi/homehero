"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "portalPublicId";

function extractPortalCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("/portal/")) return trimmed;
  const match = trimmed.match(/\/portal\/([^/?#]+)/);
  return match?.[1] ?? "";
}

export default function PortalEntryForm({ locale }: { locale: string }) {
  const t = useTranslations("portal.root");
  const router = useRouter();
  const searchParams = useSearchParams();
  const skipAuto = searchParams.get("change") === "1";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedCode, setSavedCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only available after client hydration.
      setSavedCode(stored);
      if (!skipAuto) {
        const timer = window.setTimeout(() => {
          router.replace(`/${locale}/portal/${stored}`);
        }, 200);
        return () => window.clearTimeout(timer);
      }
    }
    return undefined;
  }, [locale, router, skipAuto]);

  const helperText = useMemo(() => t("codeHelp"), [t]);

  return (
    <form
      className="mt-6 flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const extracted = extractPortalCode(code);
        if (!extracted) {
          setError(t("codeError"));
          return;
        }
        setError(null);
        router.push(`/${locale}/portal/${extracted}`);
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("codeLabel")}</span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="touch-manipulation rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50"
          placeholder={t("codePlaceholder")}
          autoComplete="one-time-code"
          inputMode="text"
        />
      </label>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{helperText}</p>
      {savedCode ? (
        <button
          type="button"
          className="w-fit touch-manipulation text-xs text-emerald-600 hover:underline"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(STORAGE_KEY);
            }
            setSavedCode(null);
          }}
        >
          {t("notYou")}
        </button>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <button
        type="submit"
        className="touch-manipulation rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
      >
        {t("openPortal")}
      </button>
    </form>
  );
}
