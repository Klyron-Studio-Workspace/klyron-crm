// `npm run backup`: dumps the database and archives uploaded files into BACKUP_DIR/<timestamp>/,
// then deletes backups older than BACKUP_KEEP_DAYS. On the VPS, PM2 runs it nightly
// (deploy/ecosystem.config.cjs). Copy BACKUP_DIR off the server too: a backup on the same disk
// doesn't survive losing that disk.
import { spawn } from "node:child_process"
import { createWriteStream, mkdirSync, readdirSync, rmSync, statSync } from "node:fs"
import path from "node:path"
import { pipeline } from "node:stream/promises"
import { createGzip } from "node:zlib"

const ROOT = path.resolve(import.meta.dirname, "..")
const BACKUP_DIR = path.resolve(ROOT, process.env.BACKUP_DIR || "storage/backups")
const UPLOAD_DIR = path.resolve(ROOT, process.env.UPLOAD_DIR || "storage/uploads")
const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS) || 14
const MYSQLDUMP = process.env.MYSQLDUMP || "mysqldump"

const log = (msg) => console.log(`[backup] ${msg}`)

function exitCode(child, name) {
  return new Promise((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${name} exited with code ${code}`))))
  })
}

async function dumpDatabase(file) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set")
  const url = new URL(process.env.DATABASE_URL)
  const args = [
    `--host=${url.hostname}`,
    `--port=${url.port || 3306}`,
    `--user=${decodeURIComponent(url.username)}`,
    "--single-transaction",
    "--quick",
    "--routines",
    "--triggers",
    decodeURIComponent(url.pathname.slice(1)),
  ]
  // Password via env so it never shows up in the process list.
  const child = spawn(MYSQLDUMP, args, {
    env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
    stdio: ["ignore", "pipe", "inherit"],
  })
  await Promise.all([pipeline(child.stdout, createGzip(), createWriteStream(file)), exitCode(child, "mysqldump")])
}

async function archiveUploads(file) {
  // `tar` ships with Linux and with Windows 10+. Relative paths: GNU tar reads "C:..." as a remote host.
  const cwd = path.dirname(file)
  const child = spawn("tar", ["-czf", path.basename(file), "-C", path.relative(cwd, UPLOAD_DIR) || ".", "."], { cwd, stdio: "inherit" })
  await exitCode(child, "tar")
}

function prune() {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000
  for (const name of readdirSync(BACKUP_DIR)) {
    const dir = path.join(BACKUP_DIR, name)
    if (statSync(dir).isDirectory() && statSync(dir).mtimeMs < cutoff) {
      rmSync(dir, { recursive: true, force: true })
      log(`removed old backup ${name}`)
    }
  }
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")
const target = path.join(BACKUP_DIR, stamp)
mkdirSync(target, { recursive: true })

try {
  await dumpDatabase(path.join(target, "database.sql.gz"))
  log("database dumped")
  mkdirSync(UPLOAD_DIR, { recursive: true })
  await archiveUploads(path.join(target, "uploads.tar.gz"))
  log("uploads archived")
  prune()
  log(`done: ${target}`)
} catch (error) {
  rmSync(target, { recursive: true, force: true })
  console.error(`[backup] FAILED: ${error.message}`)
  process.exit(1)
}
