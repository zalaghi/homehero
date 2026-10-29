"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
export default function PayrollSettingsForm({ initial }: { initial: { employerName: string; employerTaxId: string; employerAddress: string } }) {
  const t = useTranslations("admin.weeklyEmail"), a = useTranslations("admin.actions");
  const [fields, setFields] = useState(initial), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  return <form className="max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900" onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(""); try { const res = await fetch("/api/admin/payroll-settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(fields) }); setMessage(res.ok ? t("saved") : t("error")); } catch { setMessage(t("error")); } finally { setBusy(false); } }}>
    <h1 className="text-2xl font-semibold">{t("settings")}</h1><p className="mt-2 text-sm text-zinc-500">{t("settingsHelp")}</p>
    {(["employerName", "employerTaxId", "employerAddress"] as const).map(key => <label key={key} className="mt-5 block text-sm"><span>{t(key)}</span><input maxLength={key === "employerAddress" ? 250 : key === "employerName" ? 120 : 40} className="mt-2 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 dark:border-zinc-700" value={fields[key]} onChange={e => setFields({ ...fields, [key]: e.target.value })} /></label>)}
    <button disabled={busy} className="mt-6 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">{a("save")}</button><p role="status" className="mt-3 text-sm">{message}</p>
  </form>;
}
