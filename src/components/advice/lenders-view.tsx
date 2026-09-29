import { Award } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/status-badge"
import type { LenderComparison, LenderRow } from "@/lib/engine"
import { formatDate, formatEuro, formatPct } from "@/lib/format"

function AcceptBadge({ row }: { row: LenderRow }) {
  if (row.accepted === false) return <Badge variant="outline" className="border-destructive text-destructive">niet mogelijk</Badge>
  if (!row.fits) return <Badge variant="outline" className="border-amber-500 text-amber-800 dark:text-amber-300">past niet</Badge>
  if (row.accepted === null) return <Badge variant="outline">onder voorbehoud</Badge>
  return <Badge variant="secondary">mogelijk</Badge>
}

function RateCell({ row }: { row: LenderRow }) {
  if (row.ratePct === null) return <span className="text-muted-foreground">onbekend</span>
  return (
    <div className="space-y-0.5">
      <span className="font-medium">{formatPct(row.ratePct)}</span>
      <div className="text-xs text-muted-foreground">rente van {row.rateDate ? formatDate(row.rateDate) : "onbekende datum"}</div>
      {row.rateStatus && row.rateStatus !== "verified" ? <StatusBadge status={row.rateStatus} /> : null}
    </div>
  )
}

export function LendersView({ comparison, loanAmount }: { comparison: LenderComparison; loanAmount: number }) {
  return (
    <div className="space-y-6">
      {comparison.top3.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {comparison.top3.map((r, i) => (
            <Card key={r.slug} data-testid="top-lender">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award aria-hidden className="size-4 text-primary" /> {i + 1}. {r.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Rente: {formatPct(r.ratePct ?? 0)} {r.energyDiscountPct > 0 ? <span className="text-muted-foreground">(incl. {formatPct(r.energyDiscountPct)} labelkorting)</span> : null}</p>
                <p>Netto maandlast jaar 1: {formatEuro(r.netMonthlyYear1 ?? 0)}</p>
                <p>Totale kosten rentevaste periode: {formatEuro(r.totalCostsFixedPeriod ?? 0)}</p>
                <p>Maximale leenruimte: {formatEuro(r.maxLoan)}</p>
                {r.flexibility.items.length > 0 ? <p className="text-muted-foreground">Flexibel: {r.flexibility.items.join(", ")}</p> : null}
                <p className="text-xs text-muted-foreground">Rente van {r.rateDate ? formatDate(r.rateDate) : "onbekende datum"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p role="alert" className="rounded-lg border border-amber-500/50 p-4 text-sm">
          Geen geldverstrekker accepteert dit profiel met een hypotheek van {formatEuro(loanAmount)}. Bekijk de redenen hieronder.
        </p>
      )}
      <p className="text-sm text-muted-foreground">{comparison.explanation}</p>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <caption className="sr-only">Vergelijking van alle geldverstrekkers</caption>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Geldverstrekker</TableHead>
              <TableHead>Acceptatie</TableHead>
              <TableHead className="text-right">Toetsinkomen</TableHead>
              <TableHead className="text-right">Max. leenruimte</TableHead>
              <TableHead>Rente</TableHead>
              <TableHead className="text-right">Netto/mnd jaar 1</TableHead>
              <TableHead className="text-right">Gem. netto/mnd</TableHead>
              <TableHead className="text-right">Totale kosten</TableHead>
              <TableHead>Flexibiliteit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.rows.map((r) => (
              <TableRow key={r.slug} data-testid="lender-row">
                <TableCell>{r.rank}</TableCell>
                <TableCell className="font-medium">
                  {r.name}
                  {r.reasons.length > 0 ? (
                    <details className="mt-1 text-xs font-normal text-muted-foreground">
                      <summary className="cursor-pointer">Toelichting</summary>
                      <ul className="mt-1 max-w-xs list-disc pl-4 whitespace-normal">
                        {r.reasons.slice(0, 8).map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </TableCell>
                <TableCell><AcceptBadge row={r} /></TableCell>
                <TableCell className="text-right tabular-nums">{formatEuro(r.toetsinkomen)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatEuro(r.maxLoan)}</TableCell>
                <TableCell><RateCell row={r} /></TableCell>
                <TableCell className="text-right tabular-nums">{r.netMonthlyYear1 !== null ? formatEuro(r.netMonthlyYear1) : "–"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.avgNetMonthlyFixed !== null ? formatEuro(r.avgNetMonthlyFixed) : "–"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.totalCostsFixedPeriod !== null ? formatEuro(r.totalCostsFixedPeriod) : "–"}</TableCell>
                <TableCell>{r.flexibility.score.toLocaleString("nl-NL")} / 5</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
