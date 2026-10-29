"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
type Config = { weeklyEmailEnabled: boolean; email: string | null; weeklyEmails: Array<{ id: string; weekStart: string; status: string; sentAt: string | null; lastError: string | null }> };
export default function WeeklyEmailPanel({ employeeId }: { employeeId: string }) {
  const t = useTranslations("admin.weeklyEmail");
  const [data, setData] = useState<Config | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const res = await fetch(`/api/admin/employees/${employeeId}/weekly-email`, { cache: "no-store" }); if (!res.ok) throw new Error(); setData(await res.json()); } catch { setError(t("error")); }
  }, [employeeId, t]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
  useEffect(() => { void load(); }, [load]);
  return <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
    <h2 className="font-semibold">{t("title")}</h2><p className="mt-2 text-sm text-zinc-500">{t("schedule")}</p>
    {data && <><p className="mt-2 break-all text-sm">{data.email}</p><label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" checked={data.weeklyEmailEnabled} disabled={busy} onChange={async e => { const enabled = e.target.checked; setBusy(true); setError(null); try { const res = await fetch(`/api/admin/employees/${employeeId}/weekly-email`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }) }); if (!res.ok) { const d = await res.json(); throw new Error(d.error); } await load(); } catch (e) { setError((e as Error).message || t("error")); } finally { setBusy(false); } }} />{t("enabled")}</label>
      <div className="mt-4 space-y-2">{data.weeklyEmails.map(job => <div key={job.id} className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-700"><span>{job.weekStart.slice(0,10)} · {job.status}</span>{job.sentAt && <span> · {new Date(job.sentAt).toLocaleString()}</span>}{job.lastError && <p className="mt-1 text-amber-600">{job.lastError}</p>}</div>)}</div></>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
  </section>;
}
