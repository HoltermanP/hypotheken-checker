import { NextResponse } from "next/server"
import { isAuthorizedCron, purgeOperationalData, recordCronRun } from "@/lib/cron"
import { purgeExpiredDocuments } from "@/lib/services/documents"

export const runtime = "nodejs"
export const maxDuration = 120

/** Dagelijks: documenten na de bewaartermijn verwijderen (blob + rij) en operationele data opschonen. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Niet toegestaan" }, { status: 401 })
  try {
    const documents = await purgeExpiredDocuments()
    const operational = await purgeOperationalData()
    await recordCronRun("cleanup", "ok", { documents, ...operational })
    return NextResponse.json({ documents, ...operational })
  } catch (err) {
    await recordCronRun("cleanup", "error", { error: (err as Error).name })
    return NextResponse.json({ error: "Opschonen mislukt" }, { status: 500 })
  }
}
