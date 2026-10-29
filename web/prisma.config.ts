import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Some CLI commands (format/validate) don't require a DB connection.
  // Migrations/introspection will require DATABASE_URL at runtime.
  datasource: process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : undefined,
  migrations: {
    path: "prisma/migrations",
  },
});

