"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type BrandingSettings = {
  appName: string;
  logoUrl: string | null;
  iconUrl: string | null;
};

export default function BrandingPanel() {
  const t = useTranslations("admin.branding");
  const tCommon = useTranslations("common");
  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [form, setForm] = useState<BrandingSettings>({
    appName: "",
    logoUrl: "",
    iconUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      const res = await fetch("/api/admin/branding", { credentials: "include" });
      const data = (await res.json().catch(() => null)) as
        | { settings?: BrandingSettings; error?: string }
        | null;
      if (!res.ok || !data?.settings) {
        setError(data?.error ?? t("errors.load"));
        return;
      }
      setSettings(data.settings);
      setForm({
        appName: data.settings.appName,
        logoUrl: data.settings.logoUrl ?? "",
        iconUrl: data.settings.iconUrl ?? "",
      });
    }

    void load();
  }, [t]);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/admin/branding", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appName: form.appName.trim(),
        logoUrl: form.logoUrl?.trim() ?? "",
        iconUrl: form.iconUrl?.trim() ?? "",
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { settings?: BrandingSettings; error?: string }
      | null;
    if (!res.ok || !data?.settings) {
      setError(data?.error ?? t("errors.save"));
      setSaving(false);
      return;
    }
    setSettings(data.settings);
    setSuccess(t("saved"));
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium">{t("fields.appName.label")}</label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("fields.appName.help")}</p>
            <input
              className="mt-2 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none dark:border-white/10 dark:bg-black"
              value={form.appName}
              onChange={(e) => setForm((prev) => ({ ...prev, appName: e.target.value }))}
              placeholder={t("fields.appName.placeholder")}
            />
          </div>

          <div>
            <label className="text-sm font-medium">{t("fields.logoUrl.label")}</label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("fields.logoUrl.help")}</p>
            <input
              className="mt-2 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none dark:border-white/10 dark:bg-black"
              value={form.logoUrl ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
              placeholder={t("fields.logoUrl.placeholder")}
            />
          </div>

          <div>
            <label className="text-sm font-medium">{t("fields.iconUrl.label")}</label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("fields.iconUrl.help")}</p>
            <input
              className="mt-2 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none dark:border-white/10 dark:bg-black"
              value={form.iconUrl ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, iconUrl: e.target.value }))}
              placeholder={t("fields.iconUrl.placeholder")}
            />
          </div>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {success ? <div className="text-sm text-emerald-600">{success}</div> : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? tCommon("saving") : tCommon("save")}
            </button>
            <button
              type="button"
              className="rounded-md border border-black/10 px-4 py-2 text-sm text-zinc-600 hover:bg-black/5 disabled:opacity-60 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
              onClick={() =>
                setForm({
                  appName: settings?.appName ?? "",
                  logoUrl: settings?.logoUrl ?? "",
                  iconUrl: settings?.iconUrl ?? "",
                })
              }
              disabled={saving}
            >
              {t("actions.reset")}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-black/10 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-black dark:text-zinc-300">
          <div className="font-medium">{t("preview.title")}</div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("preview.help")}</p>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
                {form.logoUrl ? (
                  <Image src={form.logoUrl} alt={t("preview.logoAlt")} width={36} height={36} unoptimized />
                ) : (
                  <span className="text-xs text-zinc-400">{t("preview.logoEmpty")}</span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold">{form.appName || settings?.appName}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("preview.portalLabel")}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
                {form.iconUrl ? (
                  <Image src={form.iconUrl} alt={t("preview.iconAlt")} width={32} height={32} unoptimized />
                ) : (
                  <span className="text-xs text-zinc-400">{t("preview.iconEmpty")}</span>
                )}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{t("preview.iconHint")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
