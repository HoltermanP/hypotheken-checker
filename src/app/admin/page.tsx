import Link from "next/link"
import { desc } from "drizzle-orm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDb, schema } from "@/lib/db/client"
import { formatDate } from "@/lib/format"
import { getActiveNormSet, getLenders, getRates } from "@/lib/services/reference-data"

export const dynamic = "force-dynamic"

export default async function AdminHome() {
  const [norms, lenders, rates] = await Promise.all([getActiveNormSet(), getLenders(), getRates()])
  const metas = Object.values(norms.meta)
  const unverified = metas.filter((m) => m.status !== "verified").length
  const oldestCheck = metas.map((m) => m.checkedAt).filter(Boolean).sort()[0]
  const latestByLender = new Map<string, string>()
  for (const r of rates) if (!latestByLender.has(r.lenderSlug) || r.rateDate > latestByLender.get(r.lenderSlug)!) latestByLender.set(r.lenderSlug, r.rateDate)
  let runs: { job: string; status: string; at: Date }[] = []
  try {
    runs = await getDb().select().from(schema.cronRuns).orderBy(desc(schema.cronRuns.at)).limit(10)
  } catch {
    runs = []
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Beheer</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Actieve normen</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>Jaar {norms.year}, versie {norms.version}</p>
            <p>{metas.length} parameters, waarvan {unverified} te verifiëren</p>
            {oldestCheck ? <p>Oudste controle: {formatDate(oldestCheck)}</p> : null}
            <Link href="/admin/normen" className="text-primary underline">Normen beheren</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Geldverstrekkers</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>{lenders.filter((l) => l.active).length} actief, {lenders.length} totaal</p>
            <Link href="/admin/geldverstrekkers" className="text-primary underline">Banken en rentes beheren</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Laatste cron-runs</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {runs.length === 0 ? <p className="text-muted-foreground">Nog geen runs.</p> : (
              <ul className="space-y-1">
                {runs.map((r, i) => (
                  <li key={i}>{r.job}: {r.status} ({formatDate(r.at)})</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <section aria-labelledby="rentedata">
        <h2 id="rentedata" className="mb-2 text-lg font-semibold">Actualiteit rentes per bank</h2>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {lenders.filter((l) => l.active).map((l) => (
            <li key={l.slug}>
              <Link href={`/admin/geldverstrekkers/${l.slug}`} className="underline">{l.name}</Link>:{" "}
              {latestByLender.get(l.slug) ? `rente van ${formatDate(latestByLender.get(l.slug)!)}` : "geen rentes"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
