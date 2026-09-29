import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Alles onder /app en /admin vereist een ingelogde gebruiker. API-routes controleren zelf
 * authenticatie en eigendom (401/403) — behalve cron (CRON_SECRET) en de Blob-upload-callback
 * (ondertekend door Vercel Blob).
 */
/** Pagina's onder /app en /admin. Elke pagina, layout en server action controleert daarnaast zelf auth. */
const isProtectedPage = (req: NextRequest) => /^\/(app|admin)(\/|$)/.test(req.nextUrl.pathname)

const e2eMode =
  process.env.E2E_TEST_MODE === "1" &&
  process.env.VERCEL_ENV !== "production" &&
  process.env.VERCEL !== "1"

function e2eProxy(req: NextRequest) {
  if (isProtectedPage(req) && !req.cookies.get("e2e_user")) {
    return NextResponse.redirect(new URL("/sign-in", req.url))
  }
  return NextResponse.next()
}

const clerkProxy = clerkMiddleware(async (auth, req) => {
  if (isProtectedPage(req)) await auth.protect()
})

export default e2eMode ? e2eProxy : clerkProxy

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
