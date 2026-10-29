"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type CalendarPayload = {
  name: string;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string;
  defaultLocale: string;
};

export default function CalendarForm(props: {
  mode: "create" | "edit";
  calendarId?: string;
  initial?: Partial<CalendarPayload>;
  onDonePath: string;
}) {
  const t = useTranslations("admin.holidayCalendarsForm");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(props.initial?.name ?? "");
  const [country, setCountry] = useState(props.initial?.country ?? "");
  const [region, setRegion] = useState(props.initial?.region ?? "");
  const [city, setCity] = useState(props.initial?.city ?? "");
  const [timezone, setTimezone] = useState(props.initial?.timezone ?? "Europe/Madrid");
  const [defaultLocale, setDefaultLocale] = useState(props.initial?.defaultLocale ?? "en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload: CalendarPayload = {
    name,
    country: country.trim() ? country.trim() : null,
    region: region.trim() ? region.trim() : null,
    city: city.trim() ? city.trim() : null,
    timezone,
    defaultLocale,
  };

  const canSubmit = name.trim().length > 0 && timezone.trim().length > 0;

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const url =
        props.mode === "create"
          ? "/api/admin/holiday-calendars"
          : `/api/admin/holiday-calendars/${props.calendarId}`;
      const method = props.mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? t("errors.save"));
        return;
      }
      window.location.href = props.onDonePath;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">{t("fields.name")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("placeholders.name")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.country")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={t("placeholders.country")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.region")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder={t("placeholders.region")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.city")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("placeholders.city")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.defaultLocale")}</span>
          <select
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value)}
          >
            <option value="en">{t("languageOptions.english")}</option>
            <option value="es">{t("languageOptions.spanish")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">{t("fields.timezone")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder={t("placeholders.timezone")}
          />
        </label>
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}

      <div className="mt-4">
        <button
          disabled={!canSubmit || loading}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={submit}
        >
          {loading
            ? tCommon("saving")
            : props.mode === "create"
              ? t("actions.create")
              : t("actions.save")}
        </button>
      </div>
    </div>
  );
}
