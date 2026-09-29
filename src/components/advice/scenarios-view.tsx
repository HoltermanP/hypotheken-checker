"use client"

import { Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/forms/fields"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { saveScenariosAction } from "@/app/app/dossiers/[id]/advies/actions"
import type { ScenarioDefinition, ScenarioSummary } from "@/lib/engine"
import { formatEuro, formatPct } from "@/lib/format"

const ROWS: { label: string; render: (s: ScenarioSummary) => string }[] = [
  { label: "Maximale hypotheek", render: (s) => formatEuro(s.maxMortgage) },
  { label: "Hypotheekbedrag", render: (s) => formatEuro(s.loanAmount) },
  { label: "Rente", render: (s) => formatPct(s.ratePct) },
  { label: "NHG", render: (s) => (s.nhg ? "ja" : "nee") },
  { label: "Bruto maandlast", render: (s) => formatEuro(s.grossMonthly) },
  { label: "Netto maandlast", render: (s) => formatEuro(s.netMonthly) },
  { label: "Rente eerste 10 jaar (bruto)", render: (s) => formatEuro(s.interest10) },
  { label: "Netto rentekosten 10 jaar", render: (s) => formatEuro(s.netCost10) },
  { label: "Eigen geld gebruikt", render: (s) => formatEuro(s.ownFundsUsed) },
  { label: "Tekort", render: (s) => formatEuro(s.shortfall) },
  { label: "Rode stresstests", render: (s) => String(s.redStress) },
]

function Editor({ dossierId, initial, isDga, isMover }: { dossierId: string; initial: ScenarioDefinition[]; isDga: boolean; isMover: boolean }) {
  const router = useRouter()
  const [defs, setDefs] = useState<ScenarioDefinition[]>(initial)
  const [pending, start] = useTransition()
  const update = (i: number, patch: Partial<ScenarioDefinition["overrides"]> | { name: string }) =>
    setDefs((d) => d.map((x, j) => (j !== i ? x : "name" in patch ? { ...x, name: patch.name } : { ...x, overrides: { ...x.overrides, ...patch } })))
  const clean = (o: ScenarioDefinition["overrides"]) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null))
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer font-medium">{"Scenario's aanpassen (maximaal 4)"}</summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {defs.map((d, i) => (
          <fieldset key={d.id} className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Scenario {i + 1}</legend>
            <div className="space-y-1">
              <Label htmlFor={`sn-${i}`}>Naam</Label>
              <Input id={`sn-${i}`} value={d.name} onChange={(e) => update(i, { name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`fy-${i}`}>Rentevast</Label>
                <select id={`fy-${i}`} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm" value={d.overrides.fixedRateYears ?? ""} onChange={(e) => update(i, { fixedRateYears: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">zoals intake</option>
                  {[5, 10, 15, 20, 30].map((y) => (
                    <option key={y} value={y}>{y} jaar</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`nhg-${i}`}>NHG</Label>
                <select id={`nhg-${i}`} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm" value={d.overrides.nhg ?? ""} onChange={(e) => update(i, { nhg: (e.target.value || undefined) as "yes" | "no" | undefined })}>
                  <option value="">zoals intake</option>
                  <option value="yes">met NHG</option>
                  <option value="no">zonder NHG</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`of-${i}`}>Spaargeld inbrengen</Label>
                <select id={`of-${i}`} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm" value={typeof d.overrides.ownFunds === "string" ? d.overrides.ownFunds : ""} onChange={(e) => update(i, { ownFunds: (e.target.value || undefined) as "all" | "none" | undefined })}>
                  <option value="">zoals intake</option>
                  <option value="all">alles boven de buffer</option>
                  <option value="none">niets extra</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`rp-${i}`}>Rente (optioneel)</Label>
                <Input id={`rp-${i}`} type="number" step="0.01" value={d.overrides.ratePct ?? ""} onChange={(e) => update(i, { ratePct: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pp-${i}`}>Koopsom (optioneel)</Label>
                <MoneyInput id={`pp-${i}`} value={d.overrides.purchasePrice ?? null} onChange={(v) => update(i, { purchasePrice: v ?? undefined })} />
              </div>
              {isMover ? (
                <div className="space-y-1">
                  <Label htmlFor={`mo-${i}`}>Volgorde</Label>
                  <select id={`mo-${i}`} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm" value={d.overrides.moveOrder ?? ""} onChange={(e) => update(i, { moveOrder: (e.target.value || undefined) as "buy_first" | "sell_first" | undefined })}>
                    <option value="">zoals intake</option>
                    <option value="buy_first">eerst kopen</option>
                    <option value="sell_first">eerst verkopen</option>
                  </select>
                </div>
              ) : null}
              {isDga ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor={`sal-${i}`}>Salaris DGA verhogen met</Label>
                    <MoneyInput id={`sal-${i}`} value={d.overrides.salaryIncrease ?? null} onChange={(v) => update(i, { salaryIncrease: v ?? undefined })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!d.overrides.ownBv} onChange={(e) => update(i, { ownBv: e.target.checked || undefined })} /> Hypotheek bij eigen BV
                  </label>
                </>
              ) : null}
            </div>
            {defs.length > 1 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setDefs((x) => x.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden /> Verwijderen
              </Button>
            ) : null}
          </fieldset>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {defs.length < 4 ? (
          <Button type="button" variant="outline" onClick={() => setDefs((x) => [...x, { id: `s${Date.now()}`, name: `Scenario ${x.length + 1}`, overrides: {} }])}>
            <Plus aria-hidden /> Scenario toevoegen
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveScenariosAction(dossierId, defs.map((d) => ({ ...d, overrides: clean(d.overrides) })))
              if (!r.ok) toast.error(r.error)
              else {
                toast.success("Scenario's opgeslagen")
                router.refresh()
              }
            })
          }
        >
          {"Opslaan en doorrekenen"}
        </Button>
      </div>
    </details>
  )
}

export function ScenariosView({ dossierId, results, defs, isDga, isMover }: { dossierId: string; results: ScenarioSummary[]; defs: ScenarioDefinition[]; isDga: boolean; isMover: boolean }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <caption className="sr-only">{"Scenario's naast elkaar"}</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Uitkomst</TableHead>
              {results.map((s) => (
                <TableHead key={s.id} scope="col" className="text-right">{s.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.label}>
                <TableHead scope="row" className="font-normal text-muted-foreground">{row.label}</TableHead>
                {results.map((s) => (
                  <TableCell key={s.id} className="text-right tabular-nums">{row.render(s)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {results.flatMap((s) => s.notes.map((n) => <p key={s.id + n} className="text-sm text-muted-foreground">{s.name}: {n}</p>))}
      <Editor dossierId={dossierId} initial={defs} isDga={isDga} isMover={isMover} />
    </div>
  )
}
