"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type ImportMode = "SKIP" | "OVERWRITE" | "MERGE";

type ImportResponse =
  | {
      dryRun: true;
      mode: ImportMode;
      summary: { total: number; toCreate: number; toOverwrite: number; toMerge: number; toSkip: number };
      preview: Array<{ date: string; action: string }>;
    }
  | {
      dryRun: false;
      mode: ImportMode;
      summary: { total: number; toCreate: number; toOverwrite: number; toMerge: number; toSkip: number };
      result: { created: number; overwritten: number; merged: number; skipped: number };
    };

export default function ImportPanel(props: { calendarId: string; defaultLocale: string; city?: string }) {
  const t = useTranslations("admin.holidayCalendarImport");
  const tCommon = useTranslations("common");
  const [mode, setMode] = useState<ImportMode>("SKIP");
  const [dryRun, setDryRun] = useState(true);
  const [filterCity, setFilterCity] = useState(() => Boolean(props.city));
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [url, setUrl] = useState("");
  const [csvText, setCsvText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(file || url.trim() || csvText.trim()), [file, url, csvText]);

  async function runImport() {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const endpoint = `/api/admin/holiday-calendars/${props.calendarId}/import`;

      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.set("mode", mode);
        fd.set("dryRun", dryRun ? "true" : "false");
        fd.set("filterCity", filterCity ? "true" : "false");
        fd.set("replaceExisting", replaceExisting ? "true" : "false");
        fd.set("file", file);
        res = await fetch(endpoint, { method: "POST", credentials: "include", body: fd });
      } else {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            mode,
            dryRun,
            filterCity,
            replaceExisting,
            url: url.trim() ? url.trim() : undefined,
            csvText: csvText.trim() ? csvText : undefined,
          }),
        });
      }

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? t("errors.importFailed"));
        return;
      }
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      <div className="grid grid-cols-1 gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("mode.label")}</span>
            <select
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
              value={mode}
              onChange={(e) => setMode(e.target.value as ImportMode)}
            >
              <option value="SKIP">{t("mode.skip")}</option>
              <option value="OVERWRITE">{t("mode.overwrite")}</option>
              <option value="MERGE">{t("mode.merge")}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-7 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            {t("dryRun")}
          </label>
        </div>

        {props.city ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filterCity}
              onChange={(e) => setFilterCity(e.target.checked)}
            />
            {t("filterCity", { city: props.city })}
          </label>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
          />
          {t("replaceExisting")}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("urlImport.label")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            placeholder={t("urlImport.placeholder")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fileUpload.label")}</span>
          <input
            type="file"
            accept=".ics,.csv,text/calendar,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("csvPaste.label")}</span>
          <textarea
            className="min-h-28 rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            placeholder={t("csvPaste.placeholder")}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("csvPaste.help", { locale: props.defaultLocale })}
          </span>
        </label>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <button
          disabled={!canSubmit || loading}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={runImport}
        >
          {loading ? tCommon("running") : dryRun ? t("actions.preview") : t("actions.apply")}
        </button>

        {result ? (
          <div className="rounded-lg border border-black/10 bg-black/5 p-3 text-xs dark:border-white/10 dark:bg-white/5">
            <div className="font-medium">
              {result.dryRun ? t("result.preview") : t("result.applied")} • {t("result.mode", { mode: result.mode })}
            </div>
            <div className="mt-1 text-zinc-700 dark:text-zinc-200">
              {t("result.summary", {
                total: result.summary?.total,
                create: result.summary?.toCreate,
                overwrite: result.summary?.toOverwrite,
                merge: result.summary?.toMerge,
                skip: result.summary?.toSkip,
              })}
            </div>
            {"preview" in result ? (
              <div className="mt-2 max-h-48 overflow-auto rounded border border-black/10 bg-white p-2 dark:border-white/10 dark:bg-zinc-950">
                {result.preview.slice(0, 50).map((p) => (
                  <div key={`${p.date}-${p.action}`} className="flex items-center justify-between gap-2">
                    <div className="font-mono">{p.date}</div>
                    <div className="text-zinc-600 dark:text-zinc-400">{p.action}</div>
                  </div>
                ))}
                {result.preview.length > 50 ? (
                  <div className="mt-1 text-zinc-500">{t("result.previewLimit")}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
