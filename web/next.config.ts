import { resolve } from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Load .env.local from project root so users only need one env file.
// dotenv sets process.env at config-load time; the `env` property below
// ensures Next.js propagates these vars to all server routes/workers
// (Turbopack may not inherit process.env mutations from config phase).
const rootEnv = config({ path: resolve(process.cwd(), "..", ".env.local") });

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://127.0.0.1:3000"],
  env: rootEnv.parsed ?? {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
    ],
  },
  output: "standalone",
  transpilePackages: ["shared"],
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          // CSP is set dynamically by middleware with nonce-based script-src
        ],
      },
    ];
  },
};

export default nextConfig;
