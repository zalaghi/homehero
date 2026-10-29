"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
export default function DeleteButton({ url, name, redirectPath, onDeleted }: { url: string; name: string; redirectPath?: string; onDeleted?: () => void | Promise<void> }) {
  const t = useTranslations("admin.actions");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  async function remove() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(url, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? t("failed")); return; }
      dialog.current?.close();
      if (onDeleted) await onDeleted();
      if (redirectPath) router.push(redirectPath);
      router.refresh();
    } catch { setError(t("failed")); } finally { setBusy(false); }
  }
  return <>
    <button type="button" className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950" onClick={() => { setError(null); dialog.current?.showModal(); }}>{t("delete")}</button>
    <dialog ref={dialog} aria-labelledby={`delete-${url}`} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl backdrop:bg-black/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" onCancel={event => { if (busy) event.preventDefault(); }}>
      <h2 id={`delete-${url}`} className="text-lg font-semibold">{t("confirmTitle")}</h2>
      <p className="mt-3 break-words text-sm">{t("confirmBody", { name })}</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" autoFocus disabled={busy} className="rounded-lg border px-4 py-2 text-sm" onClick={() => dialog.current?.close()}>{t("cancel")}</button><button type="button" disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void remove()}>{busy ? t("deleting") : t("delete")}</button></div>
    </dialog>
  </>;
}
