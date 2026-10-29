"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type NeedItem = {
  id: string;
  name: string;
  suggestionId: string | null;
  createdAt: string;
};

type SuggestionItem = {
  id: string;
  name: string;
  normalizedName: string;
};

function normalizeClientName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function cleanClientName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export default function EmployeeEssentialsList() {
  const t = useTranslations("portal.essentials");
  const tCommon = useTranslations("common");
  const [needs, setNeeds] = useState<NeedItem[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const cleanedQuery = cleanClientName(query);
  const normalizedQuery = normalizeClientName(query);
  const existingNames = useMemo(
    () => new Set(needs.map((need) => normalizeClientName(need.name))),
    [needs],
  );
  const isAlreadyListed = normalizedQuery ? existingNames.has(normalizedQuery) : false;
  const hasExactSuggestion = suggestions.some((suggestion) => suggestion.normalizedName === normalizedQuery);
  const canAddCustom = normalizedQuery.length >= 2 && !isAlreadyListed && !hasExactSuggestion;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/essentials", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { needs?: NeedItem[]; error?: string } | null;
      if (!res.ok || !data?.needs) {
        setError(data?.error ?? t("errors.load"));
        return;
      }
      setNeeds(data.needs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
    void load();
    const handleRefresh = () => void load();
    window.addEventListener("app:refresh", handleRefresh);
    return () => window.removeEventListener("app:refresh", handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    async function loadSuggestions() {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/employee/essentials/suggestions?q=${encodeURIComponent(normalizedQuery)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as
          | { suggestions?: SuggestionItem[]; error?: string }
          | null;
        if (!cancelled) {
          setSuggestions(res.ok && data?.suggestions ? data.suggestions : []);
        }
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }

    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [normalizedQuery]);

  async function addNeed(input: { suggestionId?: string; name?: string }) {
    setPendingId(input.suggestionId ?? "custom");
    setError(null);
    setMessage(null);
    const res = await fetch("/api/employee/essentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(res.status === 409 ? t("errors.duplicate") : data?.error ?? t("errors.add"));
      setPendingId(null);
      return;
    }
    setQuery("");
    setSuggestions([]);
    await load();
    setPendingId(null);
  }

  async function submitAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cleanedQuery) return;
    if (isAlreadyListed) {
      setError(t("errors.duplicate"));
      setMessage(null);
      return;
    }

    const exactSuggestion = suggestions.find((suggestion) => suggestion.normalizedName === normalizedQuery);
    await addNeed(exactSuggestion ? { suggestionId: exactSuggestion.id } : { name: cleanedQuery });
  }

  async function removeNeed(id: string) {
    setPendingId(id);
    setError(null);
    setMessage(null);
    const previous = needs;
    setNeeds((current) => current.filter((need) => need.id !== id));

    const res = await fetch(`/api/employee/essentials/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setNeeds(previous);
      setError(data?.error ?? t("errors.remove"));
    }
    setPendingId(null);
  }

  async function clearNeeds() {
    const confirmed = window.confirm(`${t("confirm.clearTitle")}\n\n${t("confirm.clearBody")}`);
    if (!confirmed) return;

    setPendingId("clear");
    setError(null);
    setMessage(null);
    const previous = needs;
    setNeeds([]);

    const res = await fetch("/api/employee/essentials", {
      method: "DELETE",
      credentials: "include",
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setNeeds(previous);
      setError(data?.error ?? t("errors.clear"));
      setPendingId(null);
      return;
    }

    setMessage(t("messages.cleared"));
    await load();
    setPendingId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950"
        onSubmit={submitAdd}
      >
        <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100" htmlFor="essential-search">
          {t("question")}
        </label>
        <div className="mt-3">
          <input
            id="essential-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            enterKeyHint="done"
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:border-white/10 dark:bg-black dark:text-zinc-100 dark:focus-visible:ring-white/30"
          />
        </div>

        {normalizedQuery.length >= 2 ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="flex w-full touch-manipulation items-center justify-between border-b border-black/5 px-4 py-3 text-left text-sm font-medium last:border-b-0 hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/10"
                onClick={() => void addNeed({ suggestionId: suggestion.id })}
                disabled={pendingId === suggestion.id}
              >
                <span>{suggestion.name}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("suggestions")}</span>
              </button>
            ))}
            {canAddCustom ? (
              <button
                type="button"
                className="flex w-full touch-manipulation items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/10"
                onClick={() => void addNeed({ name: cleanedQuery })}
                disabled={pendingId === "custom"}
              >
                <span>{t("addTyped", { name: cleanedQuery })}</span>
              </button>
            ) : null}
            {isAlreadyListed ? (
              <div className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                {t("alreadyListed")}
              </div>
            ) : null}
            {suggestions.length === 0 && !canAddCustom && !isAlreadyListed ? (
              <div className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                {loadingSuggestions ? tCommon("loading") : t("noSuggestions")}
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200">
          {message}
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("neededSoon")}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {t("neededCount", { count: needs.length })}
            </span>
            {needs.length > 0 ? (
              <button
                type="button"
                className="rounded-md border border-black/10 px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
                onClick={() => void clearNeeds()}
                disabled={pendingId === "clear"}
              >
                {t("clearList")}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
          {needs.map((need) => (
            <div
              key={need.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900/40"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{need.name}</span>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-black/10 text-sm font-semibold text-zinc-500 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
                aria-label={t("removeLabel", { name: need.name })}
                title={t("remove")}
                onClick={() => void removeNeed(need.id)}
                disabled={pendingId === need.id}
              >
                x
              </button>
            </div>
          ))}
          {needs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/10 bg-white p-5 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950">
              {loading ? tCommon("loading") : t("empty")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
