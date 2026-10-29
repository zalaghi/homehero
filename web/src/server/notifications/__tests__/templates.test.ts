import { describe, expect, it } from "vitest";
import { buildNotificationContent, buildWeekendRequestNotification } from "../templates";

describe("buildWeekendRequestNotification", () => {
  it("formats approved messages", () => {
    const result = buildWeekendRequestNotification({ status: "APPROVED", date: "2026-01-10", locale: "en" });
    expect(result.title).toBe("Work request approved");
    expect(result.body).toContain("2026-01-10");
  });

  it("formats rejected messages", () => {
    const result = buildWeekendRequestNotification({ status: "REJECTED", date: "2026-01-11", locale: "en" });
    expect(result.title).toBe("Work request denied");
    expect(result.body).toContain("2026-01-11");
  });

  it("formats reset messages", () => {
    const result = buildWeekendRequestNotification({ status: "PENDING", date: "2026-01-12", locale: "en" });
    expect(result.title).toBe("Work request decision reset");
    expect(result.body).toContain("pending again");
  });
});

describe("buildNotificationContent", () => {
  it("localizes todo assignment", () => {
    const result = buildNotificationContent({
      type: "TODO_ASSIGNED",
      locale: "es",
      metadata: { title: "Revisar recibos" },
    });
    expect(result.title).toBe("Nueva tarea asignada");
    expect(result.body).toContain("Revisar recibos");
  });
});
