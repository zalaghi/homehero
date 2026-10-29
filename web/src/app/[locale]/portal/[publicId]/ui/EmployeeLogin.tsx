"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function EmployeeLogin(props: { employeePublicId: string; prefillEmail?: string }) {
  const t = useTranslations("portal.login");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [email, setEmail] = useState(props.prefillEmail ?? "");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canVerify = useMemo(() => Boolean(challengeId && code.length >= 4), [challengeId, code]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("emailLabel")}</span>
        <input
          className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
          autoComplete="email"
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {t("emailHelp")}
        </span>
      </label>

      <button
        className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        disabled={loading || email.length < 4}
        onClick={async () => {
          setLoading(true);
          setStatus(null);
          try {
            const res = await fetch("/api/auth/otp/send", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                email,
                employeePublicId: props.employeePublicId,
                locale: document.documentElement.lang || "en",
              }),
            });
            const data = (await res.json().catch(() => null)) as { challengeId?: string } | null;
            if (!res.ok || !data?.challengeId) {
              setStatus(t("sendError"));
              return;
            }
            setChallengeId(data.challengeId);
            setStatus(t("sendSuccess"));
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? tCommon("sending") : t("sendCode")}
      </button>

      {challengeId ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("codeLabel")}</span>
            <input
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
          <button
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={loading || !canVerify}
          onClick={async () => {
            setLoading(true);
            setStatus(null);
            try {
              const res = await fetch("/api/auth/otp/verify", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, challengeId, code }),
              });
              if (!res.ok) {
                  setStatus(t("verifyError"));
                  return;
                }
                router.refresh();
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? tCommon("verifying") : t("verify")}
          </button>
        </>
      ) : null}

      {status ? <div className="text-sm text-zinc-600 dark:text-zinc-400">{status}</div> : null}
    </div>
  );
}
