import { networkInterfaces } from "node:os"
import type { NextConfig } from "next"

// Wi-Fi/LAN addresses, so a phone on the same network can open the dev server
// (Next blocks dev assets and hot reload from other origins by default).
const lanIps = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address))
  .map((n) => n!.address)

// `npm run tunnel` gives a random https://<name>.trycloudflare.com URL (needed on phones for
// notifications, mic and camera). Dev only: in production this would let any tunnel post actions.
const tunnelHosts = process.env.NODE_ENV === "production" ? [] : ["*.trycloudflare.com"]

const nextConfig: NextConfig = {
  allowedDevOrigins: [...lanIps, ...tunnelHosts],
  experimental: { serverActions: { allowedOrigins: tunnelHosts } },
  // Uploaded files live on disk at runtime; never trace them into the build output.
  outputFileTracingExcludes: {
    "/*": ["./storage/**/*"],
  },
}

export default nextConfig
