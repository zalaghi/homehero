"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type CalendarOption = { id: string; name: string };

type EmployeePayload = {
  firstName: string;
  lastName: string;
  phoneE164: string | null;
  email: string | null;
  homeAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  locale: string;
  timezone: string;
  currency: string;
  payFrequency: "WEEKLY_ISO" | "MONTHLY";
  dailyRateCents: number;
  openingDebtCents: number;
  attendanceSource: "UNIFI" | "MANUAL" | "HYBRID";
  unifiActorId: string | null;
  holidayCalendarId: string | null;
};

export default function EmployeeForm(props: {
  mode: "create" | "edit";
  employeeId?: string;
  initial?: Partial<EmployeePayload>;
  calendars: CalendarOption[];
  onDonePath: string;
}) {
  const t = useTranslations("admin.employeeForm");
  const tCommon = useTranslations("common");
  const [firstName, setFirstName] = useState(props.initial?.firstName ?? "");
  const [lastName, setLastName] = useState(props.initial?.lastName ?? "");
  const [phoneE164, setPhoneE164] = useState(props.initial?.phoneE164 ?? "");
  const [email, setEmail] = useState(props.initial?.email ?? "");
  const [homeAddress, setHomeAddress] = useState(props.initial?.homeAddress ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(
    props.initial?.emergencyContactName ?? "",
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    props.initial?.emergencyContactPhone ?? "",
  );
  const [locale, setLocale] = useState(props.initial?.locale ?? "en");
  const [timezone, setTimezone] = useState(props.initial?.timezone ?? "Europe/Madrid");
  const [currency, setCurrency] = useState(props.initial?.currency ?? "EUR");
  const [payFrequency, setPayFrequency] = useState<EmployeePayload["payFrequency"]>(
    props.initial?.payFrequency ?? "WEEKLY_ISO",
  );
  const [dailyRate, setDailyRate] = useState(String((props.initial?.dailyRateCents ?? 0) / 100));
  const [openingDebt, setOpeningDebt] = useState(
    String((props.initial?.openingDebtCents ?? 0) / 100),
  );
  const [attendanceSource, setAttendanceSource] = useState<EmployeePayload["attendanceSource"]>(
    props.initial?.attendanceSource ?? "HYBRID",
  );
  const [unifiActorId, setUnifiActorId] = useState(props.initial?.unifiActorId ?? "");
  const [holidayCalendarId, setHolidayCalendarId] = useState(props.initial?.holidayCalendarId ?? "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dailyRateCents = useMemo(() => {
    const n = Number(dailyRate.replace(",", "."));
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100);
  }, [dailyRate]);

  const openingDebtCents = useMemo(() => {
    const n = Number(openingDebt.replace(",", "."));
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 100);
  }, [openingDebt]);

  const payload: EmployeePayload = {
    firstName,
    lastName,
    phoneE164: phoneE164.trim() ? phoneE164.trim() : null,
    email: email.trim() ? email.trim() : null,
    homeAddress: homeAddress.trim() ? homeAddress.trim() : null,
    emergencyContactName: emergencyContactName.trim() ? emergencyContactName.trim() : null,
    emergencyContactPhone: emergencyContactPhone.trim() ? emergencyContactPhone.trim() : null,
    locale,
    timezone,
    currency,
    payFrequency,
    dailyRateCents,
    openingDebtCents,
    attendanceSource,
    unifiActorId: unifiActorId.trim() ? unifiActorId.trim() : null,
    holidayCalendarId: holidayCalendarId.trim() ? holidayCalendarId.trim() : null,
  };

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 3 &&
    email.includes("@") &&
    (!emergencyContactName.trim() || emergencyContactPhone.trim().length > 0) &&
    Number.isFinite(dailyRateCents) &&
    dailyRateCents >= 0 &&
    Number.isFinite(openingDebtCents);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const url =
        props.mode === "create" ? "/api/admin/employees" : `/api/admin/employees/${props.employeeId}`;
      const method = props.mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        if (data?.error?.includes("Unique constraint") || data?.error?.includes("P2002")) {
          setError(t("errors.duplicateContact"));
          return;
        }
        setError(data?.error ?? t("errors.save"));
        return;
      }

      window.location.href = props.onDonePath;
    } catch { setError(t("errors.save")); } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.firstName")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.lastName")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">{t("fields.phone")}</span>
          <input
            placeholder="+34600111222"
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={phoneE164}
            onChange={(e) => setPhoneE164(e.target.value)}
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("helper.phone")}
          </span>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">{t("fields.email")}</span>
          <input
            placeholder={t("placeholders.email")}
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoComplete="email"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("helper.email")}
          </span>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">{t("fields.homeAddress")}</span>
          <textarea
            rows={3}
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={homeAddress}
            onChange={(e) => setHomeAddress(e.target.value)}
            placeholder={t("placeholders.optional")}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.emergencyContactName")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            placeholder={t("placeholders.optional")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.emergencyContactPhone")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            placeholder={t("placeholders.optional")}
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("helper.emergencyContact")}
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.language")}</span>
          <select
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          >
            <option value="en">{t("languageOptions.english")}</option>
            <option value="es">{t("languageOptions.spanish")}</option>
            <option value="fa">{t("languageOptions.persian")}</option>
            <option value="de">{t("languageOptions.german")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.timezone")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder={t("placeholders.timezone")}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.currency")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder={t("placeholders.currency")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.dailyRate")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={dailyRate}
            onChange={(e) => setDailyRate(e.target.value)}
            inputMode="decimal"
            placeholder={t("placeholders.dailyRate")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.openingDebt")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={openingDebt}
            onChange={(e) => setOpeningDebt(e.target.value)}
            inputMode="decimal"
            placeholder={t("placeholders.openingDebt")}
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("helper.openingDebt")}
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.payFrequency")}</span>
          <select
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={payFrequency}
            onChange={(e) => setPayFrequency(e.target.value as EmployeePayload["payFrequency"])}
          >
            <option value="WEEKLY_ISO">{t("payFrequency.weekly")}</option>
            <option value="MONTHLY">{t("payFrequency.monthly")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("fields.attendanceSource")}</span>
          <select
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={attendanceSource}
            onChange={(e) =>
              setAttendanceSource(e.target.value as EmployeePayload["attendanceSource"])
            }
          >
            <option value="HYBRID">{t("attendanceSource.hybrid")}</option>
            <option value="MANUAL">{t("attendanceSource.manual")}</option>
            <option value="UNIFI">{t("attendanceSource.unifi")}</option>
          </select>
          <span className="text-xs leading-relaxed text-zinc-500">{t("helpers.protectAttendance")}</span>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">{t("fields.holidayCalendar")}</span>
          <select
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={holidayCalendarId}
            onChange={(e) => setHolidayCalendarId(e.target.value)}
          >
            <option value="">{t("options.none")}</option>
            {props.calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium">{t("fields.unifiActorId")}</span>
          <input
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
            value={unifiActorId}
            onChange={(e) => setUnifiActorId(e.target.value)}
            placeholder={t("placeholders.optional")}
          />
          <span className="text-xs leading-relaxed text-zinc-500">{t("helpers.unifiAccessActor")}</span>
        </label>
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}

      <div className="mt-4 flex items-center gap-2">
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
