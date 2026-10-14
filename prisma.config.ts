import { defineConfig } from "prisma/config"

// Load .env for the Prisma CLI (Node's built-in loader; Next.js loads it on its own).
for (const f of [".env", ".env.local"]) {
  try { process.loadEnvFile(f) } catch { /* missing file is fine */ }
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
