"use client";

import DeleteButton from "@/components/DeleteButton";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  publicId: string;
};

type TodoItem = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "DONE";
  createdAt: string;
  doneAt: string | null;
  employee: EmployeeOption;
};

type Filter = "OPEN" | "DONE";

export default function AdminTodoPanel({ employees }: { employees: EmployeeOption[] }) {
  const t = useTranslations("admin.todos");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const a = useTranslations("admin.actions");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [items, setItems] = useState<TodoItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const employeeLabel = useMemo(() => {
    const match = employees.find((e) => e.id === employeeId);
    return match ? `${match.firstName} ${match.lastName}` : "";
  }, [employeeId, employees]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/todos?status=${filter}`, { credentials: "include" });
      const data = (await res.json().catch(() => null)) as { items?: TodoItem[]; error?: string } | null;
      if (!res.ok || !data?.items) {
        setError(data?.error ?? t("errors.load"));
        return;
      }
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This effect synchronizes the remote resource and its loading state.
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function createTodo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
    setError(null);
    setMessage(null);

    const res = await fetch("/api/admin/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        employeeId,
      }),
    });

    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(data?.error ?? t("errors.create"));
      return;
    }

    setTitle("");
    setDescription("");
    setMessage(t("messages.created", { name: employeeLabel || t("messages.employeeFallback") }));
    await load();
    } catch { setError(t("errors.create")); } finally { setSaving(false); }
  }

  async function updateTodo(id: string, patch: Record<string, unknown>) {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/admin/todos/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error();
      setEditing(null); await load();
    } catch { setError(a("failed")); } finally { setSaving(false); }
  }
  return (
    <div className="flex flex-col gap-6">
      <form
        className="rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950"
        onSubmit={createTodo}
      >
        <div className="text-sm font-semibold">{t("form.title")}</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 text-xs text-zinc-500">{t("form.employee")}</div>
            <select
              className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} ({employee.publicId})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs text-zinc-500">{t("form.taskTitle")}</div>
            <input
              className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("form.titlePlaceholder")}
              required
            />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <div className="mb-1 text-xs text-zinc-500">{t("form.description")}</div>
          <textarea
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder={t("form.descriptionPlaceholder")}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit" disabled={saving || !employeeId || !title.trim()}
            className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            {t("actions.create")}
          </button>
          {message ? <div className="text-xs text-emerald-600">{message}</div> : null}
          {error ? <div className="text-xs text-red-600">{error}</div> : null}
        </div>
      </form>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{t("listTitle")}</div>
        <div className="inline-flex rounded-full border border-black/10 bg-white p-1 text-xs dark:border-white/10 dark:bg-zinc-950">
          {(["OPEN", "DONE"] as const).map((value) => (
            <button
              key={value}
              className={`rounded-full px-3 py-1 transition ${
                filter === value
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
              onClick={() => setFilter(value)}
            >
              {value === "OPEN" ? t("filters.open") : t("filters.done")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950"
          >
            <div className="text-sm font-semibold">{item.title}</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              {item.employee.firstName} {item.employee.lastName} •{" "}
              {item.status === "DONE" && item.doneAt
                ? t("doneOn", { date: new Date(item.doneAt).toLocaleDateString(locale) })
                : t("createdOn", { date: new Date(item.createdAt).toLocaleDateString(locale) })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={saving} className="rounded-lg border px-3 py-2 text-xs" onClick={() => { setEditing(item.id); setEditTitle(item.title); setEditDescription(item.description ?? ""); }}>{a("edit")}</button>
              <button disabled={saving} className="rounded-lg border px-3 py-2 text-xs" onClick={() => void updateTodo(item.id, { status: item.status === "DONE" ? "OPEN" : "DONE" })}>{item.status === "DONE" ? a("reopen") : a("complete")}</button>
              <DeleteButton url={`/api/admin/todos/${item.id}`} name={item.title} onDeleted={load} />
            </div>
            {editing === item.id && <div className="mt-3 grid gap-2"><input aria-label={t("form.taskTitle")} className="rounded-lg border p-2" value={editTitle} maxLength={200} onChange={e => setEditTitle(e.target.value)} /><textarea aria-label={t("form.description")} className="rounded-lg border p-2" value={editDescription} maxLength={500} onChange={e => setEditDescription(e.target.value)} /><div className="flex gap-2"><button className="rounded-lg bg-emerald-700 px-3 py-2 text-white" disabled={saving || !editTitle.trim()} onClick={() => void updateTodo(item.id, { title: editTitle, description: editDescription || null })}>{a("save")}</button><button onClick={() => setEditing(null)}>{a("cancel")}</button></div></div>}
            {item.description ? (
              <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{item.description}</div>
            ) : null}
          </div>
        ))}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 bg-white p-6 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950">
            {loading ? tCommon("loading") : t("empty")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
