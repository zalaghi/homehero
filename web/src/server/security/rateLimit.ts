import IORedis from "ioredis";

export type LockoutResult = {
  locked: boolean;
  remaining: number;
  resetAt: number;
};

type SimpleRedis = Pick<
  IORedis,
  | "status"
  | "connect"
  | "multi"
  | "expire"
  | "set"
  | "get"
  | "mget"
  | "del"
  | "ttl"
  | "on"
  >;

let redisSingleton: SimpleRedis | null = null;

function getRedis(): SimpleRedis {
  if (redisSingleton) return redisSingleton;
  const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
  // Avoid noisy unhandled events during build-time module evaluation.
  redis.on("error", () => {});
  redisSingleton = redis;
  return redis;
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

function nowMs(): number {
  return Date.now();
}

async function ensureRedisConnected(redis: SimpleRedis): Promise<boolean> {
  if (redis.status === "wait") {
    try {
      await redis.connect();
    } catch {
      if (process.env.NODE_ENV === "production") {
        return false;
      }
      return true;
    }
  }
  return true;
}

/**
 * Fixed-window rate limit (simple + robust):
 * - key is scoped by route + identifier (phone/ip)
 * - increments within the window and blocks after limit
 */
export async function rateLimitFixedWindow(input: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const redis = getRedis();
  const fallbackReset = nowMs() + input.windowSeconds * 1000;
  const connected = await ensureRedisConnected(redis);
  if (!connected) return { ok: false, remaining: 0, resetAt: fallbackReset };

  const nowSec = Math.floor(Date.now() / 1000);
  const window = Math.floor(nowSec / input.windowSeconds);
  const redisKey = `rl:${input.key}:${window}`;

  const multi = redis.multi();
  multi.incr(redisKey);
  multi.ttl(redisKey);
  const [countRes, ttlRes] = (await multi.exec()) ?? [];
  const count = Number(countRes?.[1] ?? 0);
  let ttl = Number(ttlRes?.[1] ?? -1);
  if (ttl < 0) {
    await redis.expire(redisKey, input.windowSeconds);
    ttl = input.windowSeconds;
  }

  const ok = count <= input.limit;
  return {
    ok,
    remaining: Math.max(0, input.limit - count),
    resetAt: (nowSec + ttl) * 1000,
  };
}

export async function checkLockout(key: string): Promise<LockoutResult> {
  const redis = getRedis();
  const fallbackReset = nowMs() + 15 * 60 * 1000;
  const connected = await ensureRedisConnected(redis);
  if (!connected) return { locked: true, remaining: 0, resetAt: fallbackReset };

  const lockKey = `lock:${key}`;
  const expiresAt = Number(await redis.ttl?.(lockKey));
  if (Number.isFinite(expiresAt) && expiresAt > 0) {
    return { locked: true, remaining: 0, resetAt: nowMs() + expiresAt * 1000 };
  }

  return { locked: false, remaining: 1, resetAt: fallbackReset };
}

export async function recordFailureAndMaybeLock(input: {
  key: string;
  limit: number;
  windowSeconds: number;
  lockoutSeconds: number;
}): Promise<LockoutResult> {
  const redis = getRedis();
  const fallbackReset = nowMs() + input.windowSeconds * 1000;
  const connected = await ensureRedisConnected(redis);
  if (!connected) return { locked: true, remaining: 0, resetAt: fallbackReset };

  const failKey = `fail:${input.key}`;
  const lockKey = `lock:${input.key}`;

  const currentLockTtl = Number(await redis.ttl?.(lockKey));
  if (Number.isFinite(currentLockTtl) && currentLockTtl > 0) {
    return { locked: true, remaining: 0, resetAt: nowMs() + currentLockTtl * 1000 };
  }

  const multi = redis.multi();
  multi.incr(failKey);
  multi.ttl(failKey);
  const [countRes, ttlRes] = (await multi.exec()) ?? [];

  const count = Number(countRes?.[1] ?? 0);
  let ttl = Number(ttlRes?.[1] ?? -1);
  if (ttl < 0) {
    await redis.expire(failKey, input.windowSeconds);
    ttl = input.windowSeconds;
  }

  if (count > input.limit) {
    await redis.set(lockKey, "1", "EX", input.lockoutSeconds);
    return { locked: true, remaining: 0, resetAt: nowMs() + input.lockoutSeconds * 1000 };
  }

  return { locked: false, remaining: Math.max(0, input.limit - count), resetAt: nowMs() + ttl * 1000 };
}

export async function clearFailures(key: string): Promise<void> {
  const redis = getRedis();
  const fallbackReset = nowMs();
  const connected = await ensureRedisConnected(redis);
  if (!connected) return;
  await redis.del(`fail:${key}`);
  await redis.del(`lock:${key}`);
}

