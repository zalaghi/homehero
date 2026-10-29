import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkLockout,
  clearFailures,
  recordFailureAndMaybeLock,
} from "../rateLimit";
import * as RedisMock from "ioredis";

vi.mock("ioredis", () => {
  type Entry = { value: number | string; expiresAt?: number };
  const store = new Map<string, Entry>();

  class MockRedis {
    status: string = "ready";

    multi() {
      const commands: Array<() => [string, number]> = [];
      return {
        incr: (key: string) => {
          commands.push(() => {
            const current = store.get(key);
            const next = Number(current?.value ?? 0) + 1;
            store.set(key, { value: next, expiresAt: current?.expiresAt });
            return ["incr", next];
          });
          return this;
        },
        ttl: (key: string) => {
          commands.push(() => {
            const entry = store.get(key);
            if (!entry || !entry.expiresAt) return ["ttl", -1];
            const ttl = Math.ceil((entry.expiresAt - Date.now()) / 1000);
            return ["ttl", ttl < 0 ? -1 : ttl];
          });
          return this;
        },
        exec: async () => commands.map((fn) => fn()),
      };
    }

    expire(key: string, seconds: number) {
      const entry = store.get(key) ?? { value: 0 };
      store.set(key, { ...entry, expiresAt: Date.now() + seconds * 1000 });
      return Promise.resolve(1);
    }

    set(key: string, value: string, mode?: string, seconds?: number) {
      const expiresAt = mode === "EX" && typeof seconds === "number" ? Date.now() + seconds * 1000 : undefined;
      store.set(key, { value, expiresAt });
      return Promise.resolve("OK");
    }

    get(key: string) {
      const entry = store.get(key);
      if (!entry) return Promise.resolve(null);
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return Promise.resolve(null);
      }
      return Promise.resolve(String(entry.value));
    }

    mget(...keys: string[]) {
      return Promise.all(keys.map((k) => this.get(k)));
    }

    del(key: string) {
      store.delete(key);
      return Promise.resolve(1);
    }

    ttl(key: string) {
      const entry = store.get(key);
      if (!entry) return Promise.resolve(-2);
      if (!entry.expiresAt) return Promise.resolve(-1);
      const ttl = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return Promise.resolve(ttl < 0 ? -1 : ttl);
    }

    connect() {
      this.status = "ready";
      return Promise.resolve();
    }

    on() {
      return this;
    }
  }

  return { default: MockRedis, __store: store };
});

// Ensure the in-memory Redis mock starts clean for every test run.
beforeEach(() => {
  // @ts-expect-error – only present in the test mock
  RedisMock.__store?.clear?.();
});

describe("auth lockouts", () => {
  it("locks after too many failures and can be cleared", async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await recordFailureAndMaybeLock({
        key: "otp:alice@example.com",
        limit: 3,
        windowSeconds: 60,
        lockoutSeconds: 300,
      });
      expect(res.locked).toBe(false);
    }

    const locked = await recordFailureAndMaybeLock({
      key: "otp:alice@example.com",
      limit: 3,
      windowSeconds: 60,
      lockoutSeconds: 300,
    });
    expect(locked.locked).toBe(true);

    const state = await checkLockout("otp:alice@example.com");
    expect(state.locked).toBe(true);

    await clearFailures("otp:alice@example.com");
    const afterClear = await checkLockout("otp:alice@example.com");
    expect(afterClear.locked).toBe(false);
  });
});
