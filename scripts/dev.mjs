// `npm run dev`: starts the LiveKit video server (dev mode) and Next.js together.
// The first run downloads LiveKit into .livekit/ (checksum-verified); later runs start instantly.
// Ctrl+C stops both. Use `npm run dev:next` for Next.js alone.
import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { createConnection } from "node:net"
import { networkInterfaces } from "node:os"
import path from "node:path"

const VERSION = "1.13.9"
const ROOT = path.resolve(import.meta.dirname, "..")
const DIR = path.join(ROOT, ".livekit")
const isWindows = process.platform === "win32"
const BIN = path.join(DIR, isWindows ? "livekit-server.exe" : "livekit-server")

const log = (msg) => console.log(`\x1b[35m[dev]\x1b[0m ${msg}`)

function assetName() {
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "amd64" : null
  if (!arch) return null
  if (isWindows) return `livekit_${VERSION}_windows_${arch}.zip`
  if (process.platform === "linux") return `livekit_${VERSION}_linux_${arch}.tar.gz`
  return null // macOS: `brew install livekit`
}

async function download(url) {
  const res = await fetch(url, { redirect: "follow" })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

async function ensureLiveKit() {
  if (existsSync(BIN)) return BIN
  const onPath = spawnSync(isWindows ? "where" : "which", ["livekit-server"], { encoding: "utf8" })
  if (onPath.status === 0) return onPath.stdout.split(/\r?\n/)[0].trim()

  const asset = assetName()
  if (!asset) {
    log("No LiveKit download for this OS. Install it (macOS: brew install livekit), then run npm run dev again.")
    return null
  }
  const base = `https://github.com/livekit/livekit/releases/download/v${VERSION}`
  log(`Downloading LiveKit ${VERSION} (one time, ~20 MB)…`)
  const [archive, checksums] = await Promise.all([download(`${base}/${asset}`), download(`${base}/checksums.txt`)])
  const expected = checksums.toString("utf8").split("\n").find((l) => l.trim().endsWith(asset))?.split(/\s+/)[0]
  const actual = createHash("sha256").update(archive).digest("hex")
  if (!expected || expected !== actual) throw new Error("LiveKit download failed its checksum check; not using it.")

  mkdirSync(DIR, { recursive: true })
  const archivePath = path.join(DIR, asset)
  writeFileSync(archivePath, archive)
  // Windows 10+ ships bsdtar, which also unpacks .zip. Call it by full path so Git Bash's GNU tar isn't used.
  const tar = isWindows ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar"
  const untar = spawnSync(tar, ["-xf", asset], { cwd: DIR, stdio: "inherit" })
  rmSync(archivePath, { force: true })
  if (untar.status !== 0 || !existsSync(BIN)) throw new Error("Couldn't unpack LiveKit.")
  log(`LiveKit installed in ${path.relative(ROOT, DIR)}/`)
  return BIN
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" })
    socket.once("connect", () => (socket.destroy(), resolve(true)))
    socket.once("error", () => resolve(false))
  })
}

const children = []
function run(label, command, args) {
  const child = spawn(command, args, { cwd: ROOT, stdio: label === "livekit" ? ["ignore", "ignore", "pipe"] : "inherit", shell: label === "next" && isWindows })
  if (label === "livekit") {
    // LiveKit is chatty; only surface real problems.
    child.stderr.on("data", (d) => {
      const text = d.toString()
      if (/\b(ERROR|FATAL|panic)\b/.test(text)) process.stderr.write(`\x1b[35m[livekit]\x1b[0m ${text}`)
    })
  }
  child.on("exit", (code) => {
    if (label === "next") shutdown(code ?? 0)
    else if (!stopping) log(`LiveKit stopped (exit ${code}). Video calls won't connect until you restart npm run dev.`)
  })
  children.push(child)
  return child
}

let stopping = false
function shutdown(code) {
  if (stopping) return
  stopping = true
  for (const child of children) if (!child.killed) child.kill()
  process.exit(code)
}
process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

if (process.argv.includes("--setup")) {
  // npm run dev -- --setup : just install LiveKit.
  await ensureLiveKit()
  process.exit(0)
}

try {
  if (await portInUse(7880)) {
    log("LiveKit already running on :7880")
  } else {
    const bin = await ensureLiveKit()
    if (bin) {
      run("livekit", bin, ["--dev", "--bind", "127.0.0.1"])
      log("LiveKit video server on ws://localhost:7880 (dev keys)")
    }
  }
} catch (error) {
  log(`Video calls unavailable: ${error.message}`)
}

// Next prints one "Network" address, often a VPN adapter. List the real Wi-Fi/LAN ones for phones.
const lanIps = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n.family === "IPv4" && !n.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address))
  .map((n) => n.address)
const portArg = process.argv.findIndex((a) => a === "-p" || a === "--port")
const port = portArg > -1 ? process.argv[portArg + 1] : (process.env.PORT ?? "3000")
if (lanIps.length) for (const ip of lanIps) log(`On your phone (same Wi-Fi): \x1b[1mhttp://${ip}:${port}\x1b[0m`)
else log("No Wi-Fi/LAN address found; connect this PC to the same network as your phone.")

run("next", "npx", ["next", "dev", ...process.argv.slice(2).filter((a) => a !== "--setup")])
