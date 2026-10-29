"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function AdminLoginForm() {
  const t = useTranslations("admin.loginForm");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
          const res = await fetch("/api/auth/admin/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) {
            setError(t("errors.invalidCredentials"));
            return;
          }
          // Verify that the session cookie actually stuck (helps diagnose proxy/secure-cookie issues).
          const me = await fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json());
          if (!me?.user || me.user?.role !== "ADMIN") {
            setError(
              t("errors.cookieMissing"),
            );
            return;
          }
          window.location.href = `${window.location.origin}${window.location.pathname}`;
        } finally {
          setLoading(false);
        }
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("fields.email")}</span>
        <input
          className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("fields.password")}</span>
        <input
          className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
        />
      </label>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        disabled={loading}
        className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        type="submit"
      >
        {loading ? tCommon("signingIn") : tCommon("signIn")}
      </button>
    </form>
  );
}
