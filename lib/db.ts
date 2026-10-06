import "server-only"

import { PrismaMariaDb } from "@prisma/adapter-mariadb"

import { PrismaClient } from "@/lib/generated/prisma/client"

function createClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return new PrismaClient({ adapter: new PrismaMariaDb(url) })
}

/**
 * One client per process. In development the instance survives hot reloads, but
 * it is recreated when `prisma generate` produces a new client class (after a
 * migration), so the dev server never queries with a stale schema.
 */
const globalForDb = globalThis as unknown as { db?: PrismaClient; dbClass?: typeof PrismaClient }

function getClient() {
  if (globalForDb.db && globalForDb.dbClass === PrismaClient) return globalForDb.db
  void globalForDb.db?.$disconnect()
  const client = createClient()
  if (process.env.NODE_ENV !== "production") {
    globalForDb.db = client
    globalForDb.dbClass = PrismaClient
  }
  return client
}

export const db = getClient()
