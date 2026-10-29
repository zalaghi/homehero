import { afterEach, describe, expect, it, vi } from "vitest";
import { pdfFilename, savePdfFile } from "../pdf-download";

const file = new File(["%PDF-1.7 fixture"], "HomeHero-2026-10-26-2026-11-01.pdf", { type: "application/pdf" });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("PDF saving without replacing the installed app", () => {
  it("opens the native file share sheet with the original PDF bytes", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { canShare: () => true, share });
    expect(await savePdfFile(file)).toBe("saved");
    expect(share).toHaveBeenCalledWith({ files: [file], title: file.name });
  });
  it("treats closing the share sheet as cancellation", async () => {
    vi.stubGlobal("navigator", { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")) });
    expect(await savePdfFile(file)).toBe("cancelled");
  });
  it.each([
    { userAgent: "Mozilla iPhone Safari", platform: "iPhone", maxTouchPoints: 5 },
    { userAgent: "Mozilla Mac Safari", platform: "MacIntel", maxTouchPoints: 5 },
  ])("never falls back to a native PDF navigation on iOS without file sharing", async (device) => {
    vi.stubGlobal("navigator", { ...device, canShare: () => false });
    const create = vi.spyOn(URL, "createObjectURL");
    expect(await savePdfFile(file)).toBe("unavailable");
    expect(create).not.toHaveBeenCalled();
  });
  it.each([
    { userAgent: "Mozilla/5.0 Chrome", platform: "Linux", maxTouchPoints: 0 },
    { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari", platform: "Linux armv8l", maxTouchPoints: 5 },
  ])("downloads without file sharing support while preserving the existing app", async (device) => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", device);
    const link = { href: "", download: "", target: "", rel: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => link, body: { append: vi.fn() } });
    vi.stubGlobal("window", { setTimeout });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fixture");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    expect(await savePdfFile(file)).toBe("saved");
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
    expect(link.download).toBe(file.name);
    expect(link.click).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(revoke).toHaveBeenCalledWith("blob:fixture");
  });
  it("keeps the server filename and rejects unsafe header filenames", () => {
    expect(pdfFilename(`attachment; filename="${file.name}"`)).toBe(file.name);
    expect(pdfFilename('attachment; filename="../../secret.pdf"')).toBe("HomeHero-payslip.pdf");
    expect(pdfFilename(null)).toBe("HomeHero-payslip.pdf");
  });
});
