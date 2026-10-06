import { defineConfig } from "prisma/config"

// Load .env for the Prisma CLI (Node's built-in loader; Next.js loads it on its own).
try {
  process.loadEnvFile(".env")
} catch {
  // No .env file: rely on the real environment (e.g. on the VPS).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --experimental-transform-types --no-warnings prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
