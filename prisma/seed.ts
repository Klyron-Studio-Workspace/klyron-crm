/**
 * Creates the super admin (Owner) from .env, the org settings row, and the
 * default pipeline stages and services (only when none exist yet).
 *
 *   npm run db:seed                       create the Owner if missing
 *   npm run db:seed -- --reset-password   also reset the Owner's password to
 *                                         SUPERADMIN_PASSWORD (break-glass access)
 *
 * Only the Argon2id hash is stored; the plain password lives only in .env.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

import { checkPasswordPolicy, hashPassword } from "../lib/auth/password.ts"
import { PrismaClient } from "../lib/generated/prisma/client.ts"
import { defaultServices, defaultStages } from "../lib/leads/constants.ts"

try {
  process.loadEnvFile(".env")
} catch {
  // Use the real environment.
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set in .env`)
  return value
}

async function main() {
  const email = requireEnv("SUPERADMIN_EMAIL").toLowerCase()
  const password = requireEnv("SUPERADMIN_PASSWORD")
  const name = process.env.SUPERADMIN_NAME?.trim() || "Studio Owner"
  const resetPassword = process.argv.includes("--reset-password")

  const policyError = checkPasswordPolicy(password)
  if (policyError) throw new Error(`SUPERADMIN_PASSWORD: ${policyError}`)

  const db = new PrismaClient({ adapter: new PrismaMariaDb(requireEnv("DATABASE_URL")) })

  try {
    await db.orgSettings.upsert({ where: { id: "org" }, create: { id: "org" }, update: {} })

    if ((await db.pipelineStage.count()) === 0) {
      await db.pipelineStage.createMany({
        data: defaultStages.map((stage, position) => ({ ...stage, position })),
      })
      console.log(`Created ${defaultStages.length} pipeline stages`)
    }
    if ((await db.service.count()) === 0) {
      await db.service.createMany({ data: defaultServices.map((name, position) => ({ name, position })) })
      console.log(`Created ${defaultServices.length} services`)
    }

    const existing = await db.user.findUnique({ where: { email } })

    if (!existing) {
      const user = await db.user.create({
        data: { email, name, role: "OWNER", passwordHash: await hashPassword(password) },
      })
      await db.event.create({
        data: {
          actorType: "SYSTEM",
          actorName: "Seed",
          action: "user.owner.seed",
          entityType: "user",
          entityId: user.id,
        },
      })
      console.log(`Created Owner account ${email}`)
      return
    }

    if (existing.role !== "OWNER") {
      throw new Error(`${email} exists with role ${existing.role}. Refusing to change it automatically.`)
    }

    if (resetPassword) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          passwordHash: await hashPassword(password),
          passwordChangedAt: new Date(),
          mustChangePassword: false,
          status: "ACTIVE",
          failedLoginCount: 0,
          lockedUntil: null,
        },
      })
      await db.session.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      await db.event.create({
        data: {
          actorType: "SYSTEM",
          actorName: "Seed",
          action: "user.owner.password_reset",
          entityType: "user",
          entityId: existing.id,
        },
      })
      console.log(`Reset password for Owner ${email} and signed out all sessions`)
    } else {
      console.log(`Owner ${email} already exists (use --reset-password to restore access)`)
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
