"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslations } from "next-intl";

type UploadKind = "document" | "avatar";

type EmployeeDocument = {
  id: string;
  filename: string;
  kind: string | null;
  visibleToEmployee: boolean;
  expirationDate: string | null;
  createdAt: string;
  previewUrl: string;
};

export default function IdentityUploads(props: { employeeId: string }) {
  const t = useTranslations("admin.identityUploads");
  const [status, setStatus] = useState<string | null>(null);
  const [uploadingKind, setUploadingKind] = useState<UploadKind | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState<string>("");
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);

  useEffect(() => {
    async function loadDocuments() {
      try {
        const res = await fetch(`/api/admin/employees/${props.employeeId}/documents`, {
          credentials: "include",
        });
        const data = (await res.json().catch(() => null)) as { documents?: EmployeeDocument[] } | null;
        if (res.ok && data?.documents) {
          setDocuments(data.documents);
          const latestAvatar = data.documents.find((doc) => doc.kind === "avatar");
          if (latestAvatar) {
            setAvatarPreviewUrl(`${latestAvatar.previewUrl}?t=${Date.now()}`);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    void loadDocuments();
  }, [props.employeeId]);

  async function handleFile(kind: UploadKind, file: File) {
    setStatus(null);
    setUploadingKind(kind);

    try {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("kind", kind === "avatar" ? "avatar" : "document");
      payload.append("visibleToEmployee", kind === "avatar" ? "true" : "false");
      if (expirationDate) {
        payload.append("expirationDate", new Date(expirationDate).toISOString());
      }

      const res = await fetch(`/api/admin/employees/${props.employeeId}/documents`, {
        method: "POST",
        credentials: "include",
        body: payload,
      });

      const data = (await res.json().catch(() => null)) as
        | null
        | {
            error?: string;
            previewUrl: string;
            document: EmployeeDocument;
          };

      if (!res.ok || !data || "error" in data) {
        setStatus(t("errors.upload"));
        return;
      }

      if (kind === "avatar") {
        setAvatarPreviewUrl(`${data.previewUrl}?t=${Date.now()}`);
      }

      setStatus(kind === "avatar" ? t("messages.avatarUploaded") : t("messages.documentUploaded"));
      setDocuments((prev) => [
        {
          id: data.document.id,
          filename: data.document.filename,
          kind: data.document.kind,
          visibleToEmployee: data.document.visibleToEmployee,
          expirationDate: data.document.expirationDate,
          createdAt: data.document.createdAt,
          previewUrl: data.previewUrl,
        },
        ...prev,
      ]);
    } finally {
      setUploadingKind(null);
    }
  }

  function onFileChange(kind: UploadKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void handleFile(kind, file);
    event.target.value = "";
  }

  async function handleDelete(documentId: string) {
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/employees/${props.employeeId}/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "x-requested-with": "identity-uploads" },
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok || data?.error) {
        setStatus(t("errors.delete"));
        return;
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      setStatus(t("messages.documentRemoved"));
    } catch (err) {
      console.error(err);
      setStatus(t("errors.deleteUnexpected"));
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{t("title")}</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </div>
        </div>
        {avatarPreviewUrl ? (
          <img
            src={avatarPreviewUrl}
            alt={t("avatarAlt")}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald-500"
          />
        ) : null}
      </div>

      <div className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-100">
        {t("expiredNotice")}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 rounded-lg border border-dashed border-black/10 p-3 text-sm dark:border-white/15">
          <div className="font-medium">{t("document.title")}</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            {t("document.help")}
          </div>
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-200">{t("document.expiration")}</span>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="rounded-md border border-black/10 px-2 py-1 dark:border-white/15 dark:bg-zinc-900"
            />
          </div>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => onFileChange("document", e)}
            disabled={uploadingKind !== null}
            className="text-xs"
          />
          <div className="text-xs text-zinc-500">{t("maxSize")}</div>
        </label>

        <label className="flex flex-col gap-2 rounded-lg border border-dashed border-emerald-500/60 p-3 text-sm">
          <div className="font-medium">{t("avatar.title")}</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            {t("avatar.help")}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange("avatar", e)}
            disabled={uploadingKind !== null}
            className="text-xs"
          />
          <div className="text-xs text-zinc-500">{t("maxSize")}</div>
        </label>
      </div>

      {documents.length ? (
        <div className="mt-4 rounded-lg border border-black/10 dark:border-white/10">
          <div className="border-b border-black/10 bg-black/5 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200">
            {t("recentUploads")}
          </div>
          <ul className="divide-y divide-black/10 text-xs dark:divide-white/10">
            {documents.map((doc) => {
              const expired = doc.expirationDate ? new Date(doc.expirationDate) < new Date() : false;
              return (
                <li key={doc.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{doc.filename}</span>
                    <span className="text-[11px] text-zinc-500">
                      {t("uploaded", { date: new Date(doc.createdAt).toLocaleDateString() })}{" "}
                      {doc.visibleToEmployee ? t("visibleToEmployee") : ""}
                    </span>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <a
                        href={doc.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-emerald-500/60 px-2 py-1 font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/60 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
                      >
                        {t("actions.preview")}
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleDelete(doc.id)}
                        className="rounded-full border border-rose-500/60 px-2 py-1 font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-400/60 dark:text-rose-100 dark:hover:bg-rose-900/40"
                      >
                        {t("actions.delete")}
                      </button>
                    </div>
                  </div>
                  <span
                    className={`w-fit rounded-full px-2 py-1 text-[11px] font-semibold ${
                      expired
                        ? "bg-amber-500/20 text-amber-800 dark:text-amber-100"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-100"
                    }`}
                  >
                    {doc.expirationDate ? (expired ? t("status.expired") : t("status.valid")) : t("status.noExpiry")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {status ? <div className="mt-3 text-xs text-zinc-700 dark:text-zinc-300">{status}</div> : null}
    </div>
  );
}
