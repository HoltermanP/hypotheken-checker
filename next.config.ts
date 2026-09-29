import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV !== "production"

/** Extra hosts (bijv. een eigen Clerk-domein: https://clerk.jouwdomein.nl), spatie-gescheiden. */
const extra = (process.env.CSP_EXTRA_HOSTS ?? "").split(/\s+/).filter(Boolean).join(" ")
const clerk = "https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com"

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${clerk} https://challenges.cloudflare.com ${extra}`,
  `connect-src 'self' ${clerk} https://vercel.com https://*.blob.vercel-storage.com ${extra}`,
  `img-src 'self' data: blob: https://img.clerk.com ${extra}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `frame-src 'self' blob: https://challenges.cloudflare.com ${clerk} ${extra}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer", "@electric-sql/pglite"],
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/api/(.*)", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ]
  },
}

export default nextConfig
