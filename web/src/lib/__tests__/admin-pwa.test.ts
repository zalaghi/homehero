import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/[locale]/admin/manifest.webmanifest/route";
import PortalRoot from "@/app/[locale]/portal/page";

const { currentUser, findEmployee } = vi.hoisted(() => ({
  currentUser: vi.fn(),
  findEmployee: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: currentUser }));
vi.mock("@/server/db/prisma", () => ({ getPrisma: () => ({ employee: { findUnique: findEmployee } }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/app/[locale]/portal/ui/PortalEntryForm", () => ({ default: () => null }));

describe("admin PWA launch", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each(["en", "es", "fa", "de"])("installs an independent admin app from %s without needing a session", async (locale) => {
    const response = await GET(new Request(`https://example.test/${locale}/admin/manifest.webmanifest`), { params: Promise.resolve({ locale }) });
    const manifest = await response.json();
    const employeeManifest = JSON.parse(readFileSync(new URL("../../../public/manifest.webmanifest", import.meta.url), "utf8"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/manifest+json");
    expect(manifest.start_url).toBe(`/${locale}/admin`);
    expect(manifest.id).not.toBe(employeeManifest.id ?? employeeManifest.start_url);
    expect(manifest.name).toBe("HomeHero Admin");
    expect(manifest.display).toBe("standalone");
    // Admin artwork must not replace employee icons or their existing launch URL.
    expect(employeeManifest.start_url).toBe("/en/portal");
    for (const icon of manifest.icons) {
      expect(employeeManifest.icons.some((employeeIcon: { src: string }) => employeeIcon.src === icon.src)).toBe(false);
      expect(readFileSync(new URL(`../../../public${icon.src}`, import.meta.url)).byteLength).toBeGreaterThan(0);
    }
    expect(currentUser).not.toHaveBeenCalled();
  });

  it("rejects an unsupported locale instead of publishing an unusable app", async () => {
    const response = await GET(new Request("https://example.test/xx/admin/manifest.webmanifest"), { params: Promise.resolve({ locale: "xx" }) });
    expect(response.status).toBe(404);
  });

  it("recovers a signed-in admin launched through the old employee start URL", async () => {
    currentUser.mockResolvedValue({ role: "ADMIN" });
    await expect(PortalRoot({ params: Promise.resolve({ locale: "es" }) })).rejects.toThrow("redirect:/es/admin");
    expect(findEmployee).not.toHaveBeenCalled();
  });

  it("still opens the employee's own dashboard in their preferred language", async () => {
    currentUser.mockResolvedValue({ role: "EMPLOYEE", employeeId: "fixture-employee" });
    findEmployee.mockResolvedValue({ publicId: "fixture-public", locale: "es" });
    await expect(PortalRoot({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow("redirect:/es/portal/fixture-public/dashboard");
    expect(findEmployee).toHaveBeenCalledWith({ where: { id: "fixture-employee" }, select: { publicId: true, locale: true } });
  });

  it("keeps the employee entry form available without a session", async () => {
    currentUser.mockResolvedValue(null);
    expect(await PortalRoot({ params: Promise.resolve({ locale: "en" }) })).toBeTruthy();
    expect(findEmployee).not.toHaveBeenCalled();
  });
});
