import { NextResponse } from "next/server"
import { authErrorResponse, requireUserId } from "@/lib/auth"
import { exportUserData } from "@/lib/services/account"
import { audit } from "@/lib/services/audit"

export const runtime = "nodejs"

export async function GET() {
  try {
    const userId = await requireUserId()
    const data = await exportUserData(userId)
    await audit({ userId, action: "export", entityType: "account" })
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="hypotheekcheck-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    const auth = authErrorResponse(error)
    if (auth) return auth
    return NextResponse.json({ error: "Export mislukt." }, { status: 500 })
  }
}
