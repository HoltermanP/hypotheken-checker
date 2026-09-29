import { renderToBuffer } from "@react-pdf/renderer"
import { NextResponse } from "next/server"
import { nextSteps } from "@/lib/advice/next-steps"
import { authErrorResponse, requireUserId } from "@/lib/auth"
import { ReportDocument } from "@/lib/pdf/report-document"
import { latestCalculation } from "@/lib/services/advice"
import { audit } from "@/lib/services/audit"
import { confirmedDocumentValue } from "@/lib/services/documents"
import { getOwnedDossier, NotFoundError } from "@/lib/services/dossiers"
import { getActiveNormSet } from "@/lib/services/reference-data"
import { getOrCreateReport } from "@/lib/services/report"
import { computeScenarios } from "@/lib/services/scenarios"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(_request: Request, ctx: RouteContext<"/api/dossiers/[id]/pdf">) {
  try {
    const { id } = await ctx.params
    const userId = await requireUserId()
    const dossier = await getOwnedDossier(userId, id)
    const calc = await latestCalculation(userId, id)
    if (!calc) return NextResponse.json({ error: "Nog geen advies berekend." }, { status: 404 })
    const [report, scenarios, deadline, norms] = await Promise.all([
      getOrCreateReport(userId, id, calc.id, calc.output),
      computeScenarios(userId, id).catch(() => []),
      confirmedDocumentValue(userId, id, "koopovereenkomst", "datum_financieringsvoorbehoud").catch(() => null),
      getActiveNormSet(),
    ])
    const steps = nextSteps(calc.input, {
      financingDeadline: typeof deadline === "string" ? deadline : null,
      guaranteePct: norms.values.costs.bankgarantieGuaranteePctOfPrice,
    })
    const pdf = await renderToBuffer(
      <ReportDocument
        title={dossier.title}
        out={calc.output}
        texts={report.texts}
        textSource={report.source}
        scenarios={scenarios}
        steps={steps}
        generatedAt={new Date().toISOString()}
      />
    )
    await audit({ userId, action: "export_pdf", entityType: "dossier", entityId: id, dossierId: id })
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hypotheekadvies-${id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    const auth = authErrorResponse(error)
    if (auth) return auth
    if (error instanceof NotFoundError) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 })
    console.error("PDF maken mislukt:", (error as Error).message)
    return NextResponse.json({ error: "PDF maken is mislukt." }, { status: 500 })
  }
}
