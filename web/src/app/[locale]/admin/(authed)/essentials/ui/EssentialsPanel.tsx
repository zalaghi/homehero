"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type EmployeeOption = {
  id: string;
  name: string;
};

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
  isActive: boolean;
  updatedAt: string;
};

function normalizeClientName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function EssentialsPanel() {
  const t = useTranslations("admin.essentialsPanel");
  const tCommon = useTranslations("common");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [needs, setNeeds] = useState<NeedItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionName, setSuggestionName] = useState("");
  const [suggestionSearch, setSuggestionSearch] = useState("");
  const [loadingNeeds, setLoadingNeeds] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);
  const [pendingNeedId, setPendingNeedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const filteredSuggestions = useMemo(() => {
    const query = normalizeClientName(suggestionSearch);
    if (!query) return suggestions;
    return suggestions.filter((suggestion) => normalizeClientName(suggestion.name).includes(query));
  }, [suggestions, suggestionSearch]);

  const dictionaryNames = useMemo(
    () => new Set(suggestions.map((suggestion) => suggestion.normalizedName)),
    [suggestions],
  );

  const missingNeeds = useMemo(() => {
    const seen = new Set<string>();
    return needs.filter((need) => {
      const normalizedName = normalizeClientName(need.name);
      if (!normalizedName || dictionaryNames.has(normalizedName) || seen.has(normalizedName)) return false;
      seen.add(normalizedName);
      return true;
    });
  }, [dictionaryNames, needs]);

  async function loadNeeds(employeeId?: string | null) {
    setLoadingNeeds(true);
    setError(null);
    try {
      const query = employeeId ? `?employeeId=${employeeId}` : "";
      const res = await fetch(`/api/admin/essentials/needs${query}`, { credentials: "include" });
      const data = (await res.json().catch(() => null)) as
        | {
            employees?: EmployeeOption[];
            needs?: NeedItem[];
            selectedEmployeeId?: string | null;
            error?: string;
          }
        | null;
      if (!res.ok || !data?.employees || !data.needs) {
        setError(data?.error ?? t("errors.loadNeeds"));
        return;
      }
      setEmployees(data.employees);
      setNeeds(data.needs);
      setSelectedEmployeeId(data.selectedEmployeeId ?? null);
    } finally {
      setLoadingNeeds(false);
    }
  }

  async function loadSuggestions() {
    setLoadingSuggestions(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/essentials", { credentials: "include" });
      const data = (await res.json().catch(() => null)) as
        | { suggestions?: SuggestionItem[]; error?: string }
        | null;
      if (!res.ok || !data?.suggestions) {
        setError(data?.error ?? t("errors.loadSuggestions"));
        return;
      }
      setSuggestions(data.suggestions);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
    void loadNeeds(selectedEmployeeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
    void loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addSuggestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const res = await fetch("/api/admin/essentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: suggestionName.trim() }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(res.status === 409 ? t("errors.duplicateSuggestion") : data?.error ?? t("errors.createSuggestion"));
      return;
    }

    setSuggestionName("");
    setMessage(t("messages.added"));
    await loadSuggestions();
  }

  async function removeSuggestion(id: string) {
    const confirmed = window.confirm(t("confirm.removeSuggestion"));
    if (!confirmed) return;

    setPendingSuggestionId(id);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/essentials/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(data?.error ?? t("errors.removeSuggestion"));
      setPendingSuggestionId(null);
      return;
    }
    setMessage(t("messages.removed"));
    await loadSuggestions();
    setPendingSuggestionId(null);
  }

  function openImportFilePicker() {
    importInputRef.current?.click();
  }

  async function importSuggestionsFromFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) return;

    const isTextFile = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt") || file.type === "";
    if (!isTextFile) {
      setError(t("errors.invalidImportFile"));
      setMessage(null);
      event.currentTarget.value = "";
      return;
    }

    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/essentials/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => null)) as
        | { importedCount?: number; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? t("errors.import"));
        return;
      }
      const importedCount = data?.importedCount ?? 0;
      setMessage(importedCount > 0 ? t("messages.imported", { count: importedCount }) : t("messages.importNoNew"));
      await loadSuggestions();
    } catch {
      setError(t("errors.readImportFile"));
    } finally {
      setImporting(false);
      event.currentTarget.value = "";
    }
  }

  async function createSuggestionFromName(name: string) {
    const res = await fetch("/api/admin/essentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: res.ok, status: res.status, error: data?.error };
  }

  async function addNeedToDictionary(need: NeedItem) {
    setPendingNeedId(need.id);
    setError(null);
    setMessage(null);

    const result = await createSuggestionFromName(need.name);
    if (!result.ok && result.status !== 409) {
      setError(result.error ?? t("errors.addToDictionary"));
      setPendingNeedId(null);
      return;
    }

    await loadSuggestions();
    setMessage(result.status === 409 ? t("messages.alreadyInDictionary") : t("messages.addedToDictionary"));
    setPendingNeedId(null);
  }

  async function addAllMissingToDictionary() {
    setPendingNeedId("all");
    setError(null);
    setMessage(null);

    let addedCount = 0;
    for (const need of missingNeeds) {
      const result = await createSuggestionFromName(need.name);
      if (result.ok) {
        addedCount += 1;
        continue;
      }
      if (result.status === 409) continue;
      setError(result.error ?? t("errors.addToDictionary"));
      setPendingNeedId(null);
      await loadSuggestions();
      return;
    }

    await loadSuggestions();
    setMessage(
      addedCount > 0
        ? t("messages.addedMissingToDictionary", { count: addedCount })
        : t("messages.alreadyInDictionary"),
    );
    setPendingNeedId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t("needs.title")}
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {selectedEmployee
                ? t("needs.subtitleForEmployee", { name: selectedEmployee.name })
                : t("needs.subtitle")}
            </p>
          </div>
          {missingNeeds.length > 1 ? (
            <button
              type="button"
              className="rounded-md border border-black/10 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
              onClick={() => void addAllMissingToDictionary()}
              disabled={pendingNeedId === "all"}
            >
              {t("actions.addAllMissingToDictionary")}
            </button>
          ) : null}
          <label className="text-sm">
            <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">{t("needs.employee")}</div>
            <select
              className="min-w-48 rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:border-white/10 dark:bg-black dark:text-zinc-100 dark:focus-visible:ring-white/30"
              value={selectedEmployeeId ?? ""}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
              disabled={employees.length === 0}
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {needs.map((need) => {
            const inDictionary = dictionaryNames.has(normalizeClientName(need.name));
            return (
              <div
                key={need.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900/40"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{need.name}</span>
                {inDictionary ? (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                    {t("needs.inDictionary")}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="rounded-md border border-black/10 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
                    onClick={() => void addNeedToDictionary(need)}
                    disabled={pendingNeedId === need.id || pendingNeedId === "all"}
                  >
                    {t("actions.addToDictionary")}
                  </button>
                )}
              </div>
            );
          })}
          {needs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/10 bg-white p-4 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950">
              {loadingNeeds ? tCommon("loading") : t("needs.empty")}
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950"
        onSubmit={addSuggestion}
      >
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t("dictionary.addTitle")}
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1 text-sm">
            <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">{t("dictionary.name")}</div>
            <input
              className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:ring-white/30"
              value={suggestionName}
              onChange={(event) => setSuggestionName(event.target.value)}
              placeholder={t("dictionary.placeholder")}
              required
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
            >
              {t("actions.addSuggestion")}
            </button>
            <button
              type="button"
              className="rounded-md border border-black/10 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
              onClick={openImportFilePicker}
              disabled={importing}
            >
              {importing ? tCommon("running") : t("actions.import")}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(event) => void importSuggestionsFromFile(event)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {message ? <div className="text-xs text-emerald-600 dark:text-emerald-300">{message}</div> : null}
          {error ? <div className="text-xs text-red-600 dark:text-red-300">{error}</div> : null}
        </div>
      </form>

      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t("dictionary.title")}
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {t("dictionary.count", { count: suggestions.length })}
            </p>
          </div>
          <input
            type="search"
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:border-white/10 dark:bg-black dark:text-zinc-100 dark:focus-visible:ring-white/30 sm:max-w-xs"
            value={suggestionSearch}
            onChange={(event) => setSuggestionSearch(event.target.value)}
            placeholder={t("dictionary.searchPlaceholder")}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {filteredSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900/40"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{suggestion.name}</span>
              <button
                type="button"
                className="rounded-md border border-black/10 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-white/10 dark:text-rose-300 dark:hover:bg-rose-950/30"
                onClick={() => void removeSuggestion(suggestion.id)}
                disabled={pendingSuggestionId === suggestion.id}
              >
                {t("actions.remove")}
              </button>
            </div>
          ))}
          {filteredSuggestions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/10 bg-white p-5 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950">
              {loadingSuggestions ? tCommon("loading") : t("dictionary.empty")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
