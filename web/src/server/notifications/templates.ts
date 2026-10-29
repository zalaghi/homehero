export type NotificationLocale = "en" | "es";
export type WeekendRequestDecision = "APPROVED" | "REJECTED" | "PENDING";

type NotificationInput = {
  type: "WEEKEND_REQUEST_DECISION" | "TODO_ASSIGNED" | "ESSENTIALS_UPDATED";
  locale: NotificationLocale;
  metadata: Record<string, unknown>;
};

function weekendDecisionCopy(locale: NotificationLocale, status: WeekendRequestDecision, date: string) {
  if (locale === "es") {
    if (status === "APPROVED") {
      return {
        title: "Solicitud de trabajo aprobada",
        body: `Tu solicitud para trabajar el ${date} fue aprobada.`,
      };
    }
    if (status === "REJECTED") {
      return {
        title: "Solicitud de trabajo denegada",
        body: `Tu solicitud para trabajar el ${date} fue denegada.`,
      };
    }
    return {
      title: "Solicitud en revisión",
      body: `Tu solicitud para trabajar el ${date} volvió a estar pendiente.`,
    };
  }

  if (status === "APPROVED") {
    return {
      title: "Work request approved",
      body: `Your work request for ${date} was approved.`,
    };
  }
  if (status === "REJECTED") {
    return {
      title: "Work request denied",
      body: `Your work request for ${date} was denied.`,
    };
  }
  return {
    title: "Work request decision reset",
    body: `Your work request for ${date} is pending again.`,
  };
}

function todoAssignedCopy(locale: NotificationLocale, title: string) {
  if (locale === "es") {
    return {
      title: "Nueva tarea asignada",
      body: title,
    };
  }
  return {
    title: "New task assigned",
    body: title,
  };
}

function essentialsStatusLabel(locale: NotificationLocale, status: string) {
  const normalized = status.toUpperCase();
  if (locale === "es") {
    if (normalized === "NEED_TO_BUY") return "por comprar";
    if (normalized === "BOUGHT") return "comprado";
    return "en stock";
  }
  if (normalized === "NEED_TO_BUY") return "need to buy";
  if (normalized === "BOUGHT") return "bought";
  return "in stock";
}

function essentialsCopy(locale: NotificationLocale, item: string | null, status: string) {
  const statusLabel = essentialsStatusLabel(locale, status);
  if (locale === "es") {
    return {
      title: "Esenciales actualizados",
      body: item ? `${item} pasó a ${statusLabel}.` : "Se actualizó un esencial.",
    };
  }
  return {
    title: "Essentials updated",
    body: item ? `${item} set to ${statusLabel}.` : "An essential was updated.",
  };
}

export function buildNotificationContent(input: NotificationInput): { title: string; body: string } {
  if (input.type === "WEEKEND_REQUEST_DECISION") {
    const status = String(input.metadata.status ?? "PENDING") as WeekendRequestDecision;
    const date = String(input.metadata.date ?? "");
    return weekendDecisionCopy(input.locale, status, date);
  }
  if (input.type === "TODO_ASSIGNED") {
    return todoAssignedCopy(input.locale, String(input.metadata.title ?? ""));
  }
  return essentialsCopy(
    input.locale,
    typeof input.metadata.itemName === "string" ? input.metadata.itemName : null,
    String(input.metadata.status ?? "IN_STOCK"),
  );
}

export function buildWeekendRequestNotification(input: {
  status: WeekendRequestDecision;
  date: string;
  locale: NotificationLocale;
}): { title: string; body: string } {
  return weekendDecisionCopy(input.locale, input.status, input.date);
}

export function buildDigestEmail(input: {
  locale: NotificationLocale;
  notifications: Array<{ createdAt: Date; title: string; body: string; type: string; link?: string | null }>;
  appOrigin?: string | null;
}): { subject: string; text: string; html: string } {
  const isEs = input.locale === "es";
  const subject = isEs ? "Resumen diario de avisos" : "Daily notification digest";
  const intro = isEs
    ? "Aquí tienes las novedades desde la última notificación:"
    : "Here are your updates since the last digest:";
  const footerLink = input.appOrigin ? `${input.appOrigin}/portal` : null;
  const lines = input.notifications.map((item) => {
    const time = item.createdAt.toLocaleString(input.locale === "es" ? "es-ES" : "en-US");
    const linkLabel = item.link ? ` (${item.link})` : "";
    return `- ${time} • ${item.title}: ${item.body}${linkLabel}`;
  });
  const footer = footerLink
    ? isEs
      ? `\nAccede a tu portal: ${footerLink}`
      : `\nVisit your portal: ${footerLink}`
    : "";

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const typeLabel = (type: string) => {
    if (isEs) {
      if (type === "WEEKEND_REQUEST_DECISION") return "Solicitud de trabajo";
      if (type === "TODO_ASSIGNED") return "Tareas";
      if (type === "ESSENTIALS_UPDATED") return "Esenciales";
      return "Aviso";
    }
    if (type === "WEEKEND_REQUEST_DECISION") return "Work request";
    if (type === "TODO_ASSIGNED") return "To-do";
    if (type === "ESSENTIALS_UPDATED") return "Essentials";
    return "Notification";
  };

  const rows = input.notifications
    .map((item) => {
      const time = escapeHtml(
        item.createdAt.toLocaleString(input.locale === "es" ? "es-ES" : "en-US"),
      );
      const type = escapeHtml(typeLabel(item.type));
      const title = escapeHtml(item.title);
      const body = escapeHtml(item.body);
      const link = item.link ? `<a href="${escapeHtml(item.link)}">${escapeHtml(item.link)}</a>` : "—";
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${time}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${type}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;"><strong>${title}</strong><br/><span style="color:#6b7280;">${body}</span></td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${link}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; color:#111827;">
      <p>${escapeHtml(intro)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;background:#f3f4f6;">
            <th style="padding:8px 10px;">${isEs ? "Hora" : "Time"}</th>
            <th style="padding:8px 10px;">${isEs ? "Tipo" : "Type"}</th>
            <th style="padding:8px 10px;">${isEs ? "Mensaje" : "Message"}</th>
            <th style="padding:8px 10px;">${isEs ? "Enlace" : "Link"}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${footerLink ? `<p style="margin-top:16px;"><a href="${escapeHtml(footerLink)}">${escapeHtml(footerLink)}</a></p>` : ""}
    </div>
  `;

  return {
    subject,
    text: `${intro}\n\n${lines.join("\n")}${footer}`,
    html,
  };
}
