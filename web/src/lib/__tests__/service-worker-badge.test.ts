import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
const source = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
function worker(options: { supported?: boolean; count?: number; online?: boolean } = {}) {
  const listeners = new Map<string, (event: unknown) => void>();
  const show = vi.fn().mockResolvedValue(undefined), set = vi.fn().mockResolvedValue(undefined), clear = vi.fn().mockResolvedValue(undefined);
  const context = vm.createContext({
    self: { addEventListener: (type: string, cb: (event: unknown) => void) => listeners.set(type, cb), navigator: options.supported === false ? {} : { setAppBadge: set, clearAppBadge: clear }, location: { origin: "https://example.test" }, registration: { showNotification: show }, clients: { matchAll: async () => [] } },
    URL, AbortController, setTimeout, clearTimeout,
    fetch: options.online === false ? vi.fn().mockRejectedValue(new Error("offline")) : vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unreadCount: options.count ?? 3 }) }),
  });
  vm.runInContext(source, context);
  return { show, set, clear, push: async (data: unknown) => { let done: Promise<void> | undefined; listeners.get("push")!({ data: { json: () => data }, waitUntil: (promise: Promise<void>) => { done = promise; } }); await done; } };
}
describe("installed app icon badge", () => {
  it("shows the notification and sets the unread count in the background", async () => {
    const w=worker(); await w.push({ title: "Fixture", unreadCount: 3 });
    expect(w.show).toHaveBeenCalledTimes(1); expect(w.set).toHaveBeenLastCalledWith(3);
  });
  it("clears a stale count when the server says everything has been read", async () => {
    const w=worker({ count: 0 }); await w.push({ unreadCount: 3 });
    expect(w.set).toHaveBeenCalledWith(3); expect(w.clear).toHaveBeenCalledTimes(1);
  });
  it("keeps the payload count if the device cannot refresh the inbox", async () => {
    const w=worker({ online: false }); await w.push({ unreadCount: 2 });
    expect(w.set).toHaveBeenCalledExactlyOnceWith(2); expect(w.show).toHaveBeenCalledTimes(1);
  });
  it("still displays notifications when app badges are unsupported", async () => {
    const w=worker({ supported: false }); await w.push({ unreadCount: 2 }); expect(w.show).toHaveBeenCalledTimes(1); expect(w.set).not.toHaveBeenCalled();
  });
});
