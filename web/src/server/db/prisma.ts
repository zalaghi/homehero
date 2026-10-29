import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pgPool?: Pool };

const poolConfig = {
  max: Number(process.env.PG_POOL_MAX ?? "10"),
  idleTimeoutMillis: Number(process.env.PG_POOL_IDLE_TIMEOUT_MS ?? "10000"),
  connectionTimeoutMillis: Number(process.env.PG_POOL_CONN_TIMEOUT_MS ?? "5000"),
};

function getPgPool(): Pool {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }
  const pool = new Pool({ connectionString, ...poolConfig });
  globalForPrisma.pgPool = pool;
  return pool;
}

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    adapter: new PrismaPg(getPgPool()),
  });

  globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrisma();
export const pgPool = getPgPool();
