import "server-only"
import { auth, currentUser } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isE2ETestMode } from "@/env"

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string
  ) {
    super(message)
  }
}

async function e2eUser(): Promise<{ userId: string; role: string | null } | null> {
  if (!isE2ETestMode()) return null
  const jar = await cookies()
  const userId = jar.get("e2e_user")?.value
  if (!userId) return null
  return { userId, role: jar.get("e2e_role")?.value ?? null }
}

/** Huidige gebruiker-id of null. */
export async function getUserId(): Promise<string | null> {
  const test = await e2eUser()
  if (test) return test.userId
  if (isE2ETestMode()) return null
  const { userId } = await auth()
  return userId ?? null
}

/** Voor route handlers en server actions: gooit AuthError(401) als niet ingelogd. */
export async function requireUserId(): Promise<string> {
  const userId = await getUserId()
  if (!userId) throw new AuthError(401, "Niet ingelogd")
  return userId
}

/** Voor pagina's: redirect naar inloggen als niet ingelogd. */
export async function requireUserIdOrRedirect(): Promise<string> {
  const userId = await getUserId()
  if (!userId) redirect("/sign-in")
  return userId
}

/** Admin-rol via Clerk publicMetadata.role === "admin". */
export async function isAdmin(): Promise<boolean> {
  const test = await e2eUser()
  if (test) return test.role === "admin"
  if (isE2ETestMode()) return false
  const user = await currentUser()
  return (user?.publicMetadata as { role?: string } | undefined)?.role === "admin"
}

export async function requireAdmin(): Promise<string> {
  const userId = await requireUserId()
  if (!(await isAdmin())) throw new AuthError(403, "Geen toegang")
  return userId
}

/** Zet een AuthError om in een nette JSON-response. */
export function authErrorResponse(error: unknown): Response | null {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  return null
}
