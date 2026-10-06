import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Uploaded files live on disk at runtime; never trace them into the build output.
  outputFileTracingExcludes: {
    "/*": ["./storage/**/*"],
  },
}

export default nextConfig
