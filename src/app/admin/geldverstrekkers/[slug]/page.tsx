import { and, desc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { ActionForm } from "@/components/admin/action-form"
import { StatusBadge } from "@/components/status-badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getDb, schema } from "@/lib/db/client"
import { CRITERIA_LABELS } from "@/lib/lenders/profile-kv"
import { formatDate, formatPct } from "@/lib/format"
import { toggleLenderActive, updateLenderCriterion, upsertRate } from "../../actions"

export const dynamic = "force-dynamic"

type Row = typeof schema.lenderCriteria.$inferSelect

function CriteriaList({ rows, table }: { rows: Row[]; table: "criteria" | "entrepreneur" }) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((r) => (
        <li key={r.id} className="p-3">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-medium">{CRITERIA_LABELS[r.key] ?? r.key}</span>
              <StatusBadge status={r.status} />
              <span className="text-xs text-muted-foreground">{JSON.stringify(r.value)?.slice(0, 100)}</span>
              {r.sourceUrl ? (
                <a href={r.sourceUrl} className="text-xs underline" target="_blank" rel="noreferrer">bron</a>
              ) : null}
            </summary>
            <ActionForm action={updateLenderCriterion} className="mt-3">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="table" value={table} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-3">
                  <Label htmlFor={`v-${r.id}`}>Waarde (JSON: true, false, getal, &quot;tekst&quot;, lijst of null = onbekend)</Label>
                  <Input id={`v-${r.id}`} name="value" defaultValue={JSON.stringify(r.value)} className="font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`s-${r.id}`}>Status</Label>
                  <select id={`s-${r.id}`} name="status" defaultValue={r.status} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm">
                    <option value="verified">geverifieerd</option>
                    <option value="needs_verification">te verifiëren</option>
                    <option value="unknown">onbekend</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`u-${r.id}`}>Bron-URL</Label>
                  <Input id={`u-${r.id}`} name="sourceUrl" type="url" defaultValue={r.sourceUrl ?? ""} />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <Label htmlFor={`n-${r.id}`}>Toelichting</Label>
                  <Input id={`n-${r.id}`} name="note" defaultValue={r.note ?? ""} />
                </div>
              </div>
            </ActionForm>
          </details>
        </li>
      ))}
    </ul>
  )
}

export default async function LenderAdminPage({ params }: PageProps<"/admin/geldverstrekkers/[slug]">) {
  const { slug } = await params
  const db = getDb()
  const [lender] = await db.select().from(schema.lenders).where(eq(schema.lenders.slug, slug))
  if (!lender) notFound()
  const [criteria, ent, rates] = await Promise.all([
    db.select().from(schema.lenderCriteria).where(eq(schema.lenderCriteria.lenderSlug, slug)),
    db.select().from(schema.lenderEntrepreneurPolicies).where(eq(schema.lenderEntrepreneurPolicies.lenderSlug, slug)),
    db
      .select()
      .from(schema.rateSheets)
      .where(and(eq(schema.rateSheets.lenderSlug, slug)))
      .orderBy(desc(schema.rateSheets.rateDate), schema.rateSheets.fixedYears),
  ])
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{lender.name}</h1>
        <ActionForm action={toggleLenderActive} submitLabel={lender.active ? "Deactiveren" : "Activeren"} variant="outline">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="active" value={String(!lender.active)} />
        </ActionForm>
      </div>
      {lender.activeNote ? <p className="text-sm text-muted-foreground">{lender.activeNote}</p> : null}
      <section aria-labelledby="crit">
        <h2 id="crit" className="mb-2 text-lg font-semibold">Acceptatiecriteria</h2>
        <CriteriaList rows={criteria.sort((a, b) => a.key.localeCompare(b.key))} table="criteria" />
      </section>
      <section aria-labelledby="ent">
        <h2 id="ent" className="mb-2 text-lg font-semibold">Ondernemersbeleid</h2>
        <CriteriaList rows={ent.sort((a, b) => a.key.localeCompare(b.key))} table="entrepreneur" />
      </section>
      <section aria-labelledby="rates" className="space-y-3">
        <h2 id="rates" className="text-lg font-semibold">Rentes</h2>
        <ActionForm action={upsertRate} submitLabel="Rente toevoegen" className="rounded-lg border p-3">
          <input type="hidden" name="lenderSlug" value={slug} />
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1"><Label htmlFor="fy">Rentevast (jaar)</Label><Input id="fy" name="fixedYears" type="number" defaultValue={10} /></div>
            <div className="space-y-1">
              <Label htmlFor="lc">LTV-klasse</Label>
              <select id="lc" name="ltvClass" className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm">
                {["nhg", "ltv60", "ltv70", "ltv80", "ltv90", "ltv100"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rt">Aflossingsvorm</Label>
              <select id="rt" name="repaymentType" className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm">
                <option value="annuity">annuïtair</option>
                <option value="linear">lineair</option>
                <option value="interest_only">aflossingsvrij</option>
              </select>
            </div>
            <div className="space-y-1"><Label htmlFor="rp">Rente (%)</Label><Input id="rp" name="ratePct" type="number" step="0.001" required /></div>
            <div className="space-y-1"><Label htmlFor="rd">Datum</Label><Input id="rd" name="rateDate" type="date" defaultValue={today} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="ru">Bron-URL</Label><Input id="ru" name="sourceUrl" type="url" /></div>
            <div className="space-y-1">
              <Label htmlFor="rs">Status</Label>
              <select id="rs" name="status" className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm">
                <option value="verified">geverifieerd</option>
                <option value="needs_verification">te verifiëren</option>
              </select>
            </div>
          </div>
        </ActionForm>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rentevast</TableHead>
                <TableHead>Klasse</TableHead>
                <TableHead>Vorm</TableHead>
                <TableHead>Rente</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Herkomst</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.slice(0, 200).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.fixedYears} jaar</TableCell>
                  <TableCell>{r.ltvClass}</TableCell>
                  <TableCell>{r.repaymentType}</TableCell>
                  <TableCell>{formatPct(r.ratePct, 2)}</TableCell>
                  <TableCell>{formatDate(r.rateDate)}</TableCell>
                  <TableCell>{r.origin}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
