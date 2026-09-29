import type { ReactNode } from "react"
import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/status-badge"
import { StatusLight } from "@/components/status-light"
import type { AdviceOutput, NormMeta } from "@/lib/engine"
import type { NextStep } from "@/lib/advice/next-steps"
import { formatDate, formatEuro, formatPct } from "@/lib/format"

/**
 * Onderdelen van het adviesrapport (server components). Elk getal komt uit de engine-uitvoer.
 */

export function Section({ id, title, children, intro }: { id: string; title: string; children: ReactNode; intro?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20 space-y-4" id={`sectie-${id}`}>
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {intro ? <div className="max-w-3xl text-sm leading-relaxed">{intro}</div> : null}
      {children}
    </section>
  )
}

function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y rounded-xl border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 px-4 py-2 text-sm">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function MaxMortgageSection({ out }: { out: AdviceOutput }) {
  const inc = out.capacity.income
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <KV
          rows={[
            ["Toetsinkomen (gezamenlijk)", formatEuro(inc.combinedIncome)],
            ["Toetsrente", formatPct(inc.toetsrentePct)],
            ["Financieringslastpercentage", formatPct(inc.financieringslastPct, 1)],
            ["Maximale bruto woonlast per maand", formatEuro(inc.maxAnnualCost / 12)],
            ["Verplichtingen per maand (gewogen)", formatEuro(inc.obligationsMonthly)],
            ["Leenruimte uit inkomen", formatEuro(inc.baseLoan)],
            ["Extra: energielabel", formatEuro(inc.energyLabelExtra)],
            ["Extra: energiebesparende voorzieningen", formatEuro(inc.energySavingExtra)],
            ["Extra: alleenstaande", formatEuro(inc.singleExtra)],
            ["Maximaal op inkomen", formatEuro(inc.maxLoan)],
            ["Maximaal op onderpand", out.capacity.collateral ? formatEuro(out.capacity.collateral.maxLoan) : "n.v.t."],
            ["Maximale hypotheek", formatEuro(out.capacity.maxMortgage)],
          ]}
        />
        <p className="text-sm">
          Beperkende factor: <strong>{out.capacity.limiting}</strong>.
          {inc.decisive === "aow" ? " Je inkomen na de AOW-leeftijd is bepalend (AOW-toets)." : ""}
        </p>
      </div>
      <div className="space-y-3">
        <h3 className="font-medium">Toetsinkomen per aanvrager</h3>
        <ul className="space-y-2 text-sm">
          {out.applicants.map((a) => (
            <li key={a.id} className="rounded-lg border p-3">
              <p className="font-medium">
                {a.label === "partner" ? "Partner" : "Aanvrager 1"} ({a.age} jaar): {formatEuro(a.toetsinkomen)}
              </p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {a.employeeIncome.map((e, i) => (
                  <li key={i}>
                    {formatEuro(e.amount)}: {e.reason}
                  </li>
                ))}
                {a.businessIncome.map((b) => (
                  <li key={b.businessId}>
                    {formatEuro(b.income)} uit {b.legalForm} (standaardmethode; per bank zie ondernemershoofdstuk)
                  </li>
                ))}
              </ul>
              {!a.reachedAow ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  AOW-datum {formatDate(a.aowDate)}; verwacht inkomen daarna {formatEuro(a.retirementIncome)}
                  {a.retirementIncomeAssumed ? " (alleen AOW, pensioen niet opgegeven)" : ""}.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {out.capacity.levers.length > 0 ? (
          <>
            <h3 className="font-medium">Knoppen om aan te draaien</h3>
            <ul className="space-y-1 text-sm">
              {out.capacity.levers.map((l) => (
                <li key={l.key}>
                  <strong>{l.label}</strong>
                  {l.extraLoan > 0 ? `: ${formatEuro(l.extraLoan)} extra leenruimte` : ""}. <span className="text-muted-foreground">{l.explanation}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function FinancingSection({ out }: { out: AdviceOutput }) {
  const p = out.purchase
  const m = out.mover
  return (
    <div className="space-y-4">
      {p ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 font-medium">Benodigd</h3>
            <KV rows={[...p.uses.map((u) => [u.label, formatEuro(u.amount)] as [string, string]), ["Totaal", formatEuro(p.totalUses)]]} />
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer">Specificatie kosten koper</summary>
              <ul className="mt-2 space-y-1">
                {p.costs.lines.map((l) => (
                  <li key={l.key} className="flex justify-between gap-4">
                    <span>
                      {l.label}
                      {l.deductible ? <span className="text-muted-foreground"> (aftrekbaar)</span> : null}
                      {l.note ? <span className="block text-xs text-muted-foreground">{l.note}</span> : null}
                    </span>
                    <span className="tabular-nums">{formatEuro(l.amount)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
          <div>
            <h3 className="mb-2 font-medium">Bronnen</h3>
            <KV rows={[...p.sources.map((s) => [s.label, formatEuro(s.amount)] as [string, string]), ["Tekort eigen geld", formatEuro(p.shortfall)]]} />
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>Loan-to-value: {formatPct(p.ltvPct, 1)} van de marktwaarde ({formatEuro(p.marketValue)}).</li>
              <li>{p.costsFromOwnFunds.message}</li>
              <li>NHG: {p.nhg.eligible ? "mogelijk" : "niet mogelijk"}. {p.nhg.reason}</li>
              <li>Maximale eigenwoningschuld (bijleenregeling): {formatEuro(p.maxOwnHomeDebt)}{p.box3Part > 0 ? `; ${formatEuro(p.box3Part)} valt in box 3.` : "."}</li>
            </ul>
          </div>
        </div>
      ) : null}
      {m ? (
        <div>
          <h3 className="mb-2 font-medium">Huidige woning</h3>
          <KV
            rows={[
              ["Verwachte verkoopprijs", formatEuro(m.salePrice)],
              ["Verkoopkosten", formatEuro(m.saleCosts.total)],
              ["Totale schuld", formatEuro(m.totalDebt)],
              ["Waarvan meegenomen", formatEuro(m.portedDebt)],
              ["Overwaarde", formatEuro(m.netProceeds)],
              ["Eigenwoningreserve", formatEuro(m.eigenwoningreserve)],
              ...(m.bridge ? ([["Overbruggingskrediet", `${formatEuro(m.bridge.amount)} (${m.bridge.months} mnd, rente ${formatEuro(m.bridge.interest)})`]] as [string, string][]) : []),
              ...(m.doubleCosts ? ([["Dubbele woonlasten (netto)", formatEuro(m.doubleCosts.total)]] as [string, string][]) : []),
              ...(m.temporaryHousing ? ([["Tijdelijk wonen", formatEuro(m.temporaryHousing.total)]] as [string, string][]) : []),
            ]}
          />
          {m.notes.map((n) => (
            <p key={n} className="mt-2 text-sm text-muted-foreground">{n}</p>
          ))}
        </div>
      ) : null}
      {out.refinance ? (
        <div>
          <h3 className="mb-2 font-medium">Oversluiten</h3>
          <KV
            rows={[
              ["Boeterente (totaal)", formatEuro(out.refinance.totalPenalty)],
              ["Besparing per maand", formatEuro(out.refinance.monthlySaving)],
              ["Terugverdientijd", out.refinance.paybackMonths !== null ? `${out.refinance.paybackMonths} maanden` : "geen besparing"],
              ["Rentemiddeling (indicatieve rente)", out.refinance.averagedRatePct !== null ? formatPct(out.refinance.averagedRatePct) : "–"],
              ["Netto voordeel over de nieuwe rentevaste periode", formatEuro(out.refinance.netBenefitOverFixed)],
            ]}
          />
        </div>
      ) : null}
      <div>
        <h3 className="mb-2 font-medium">Leningdelen</h3>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deel</TableHead>
                <TableHead className="text-right">Bedrag</TableHead>
                <TableHead className="text-right">Rente</TableHead>
                <TableHead className="text-right">Rentevast</TableHead>
                <TableHead>Aftrekbaar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {out.loan.parts.map((part) => (
                <TableRow key={part.id}>
                  <TableCell>{part.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(part.principal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPct(part.ratePct)}</TableCell>
                  <TableCell className="text-right">{part.fixedYears} jaar</TableCell>
                  <TableCell>{part.deductible ? "ja (box 1)" : "nee (box 3)"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {out.equity ? (
        <div>
          <h3 className="mb-2 font-medium">Eigen geld: inbrengen of aanhouden?</h3>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">Inbreng</TableHead>
                  <TableHead className="text-right">Hypotheek</TableHead>
                  <TableHead className="text-right">Rente</TableHead>
                  <TableHead className="text-right">Netto rente 10 jr</TableHead>
                  <TableHead className="text-right">Spaarrendement 10 jr</TableHead>
                  <TableHead>Buffer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {out.equity.variants.map((v) => (
                  <TableRow key={v.key}>
                    <TableCell>
                      {v.label} {out.equity!.recommended === v.key ? <Badge variant="secondary">aanbevolen</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuro(v.contribution)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuro(v.loan)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(v.ratePct)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuro(v.netInterest10)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuro(v.savingsReturn10)}</TableCell>
                    <TableCell>{v.bufferOk ? "voldoende" : "te laag"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{out.equity.explanation}</p>
        </div>
      ) : null}
    </div>
  )
}

export function BudgetSection({ out }: { out: AdviceOutput }) {
  const b = out.budget
  if (!b) return null
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <KV rows={[["Netto-inkomen per maand", formatEuro(b.netIncomeMonthly)], ...b.lines.map((l) => [l.label, formatEuro(l.monthly)] as [string, string]), ["Vrij besteedbaar", formatEuro(b.remaining)]]} />
      <div className="space-y-2 text-sm">
        <p className="flex items-start gap-2">
          <StatusLight status={b.light} /> {b.explanation}
        </p>
        <p className="text-muted-foreground">
          Nibud adviseert maandelijks ongeveer {formatEuro(b.savingsAdvice)} (10% van je netto-inkomen) te sparen. Vrij besteedbaar is bedoeld voor kleding, vervoer, vrije tijd en sparen.
        </p>
        <p className="text-muted-foreground">
          Verstandig lenen: maximaal {formatEuro(out.prudent.loan)}, met een netto maandlast van {formatEuro(out.prudent.netMonthly)}. {out.prudent.explanation}
        </p>
      </div>
    </div>
  )
}

export function EquityReleaseSection({ out }: { out: AdviceOutput }) {
  const er = out.equityRelease
  if (!er) return null
  return (
    <div className="space-y-3">
      <p className="text-sm">Extra leenruimte (inkomen én onderpand): {formatEuro(er.room)}.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {er.options.map((o) => (
          <div key={o.key} className="space-y-2 rounded-xl border p-4 text-sm">
            <p className="font-medium">
              {o.title} {!o.available ? <Badge variant="outline">niet beschikbaar</Badge> : null}
            </p>
            <p className="text-muted-foreground">{o.description}</p>
            {o.available ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Bedrag</dt>
                <dd className="text-right tabular-nums">{formatEuro(o.amount)}</dd>
                <dt className="text-muted-foreground">Effect per maand</dt>
                <dd className="text-right tabular-nums">{formatEuro(o.monthlyEffect)}</dd>
                <dt className="text-muted-foreground">Netto-effect 10 jaar</dt>
                <dd className="text-right tabular-nums">{formatEuro(o.netEffect10)}</dd>
                <dt className="text-muted-foreground">Netto-effect 30 jaar</dt>
                <dd className="text-right tabular-nums">{formatEuro(o.netEffect30)}</dd>
              </dl>
            ) : (
              <p className="text-muted-foreground">{o.unavailableReason}</p>
            )}
            <p>
              <span className="font-medium">Fiscaal:</span> {o.taxConsequences.join(" ")}
            </p>
            <p>
              <span className="font-medium">Risico&apos;s:</span> {o.risks.join(" ")}
            </p>
            {o.lenders && o.lenders.length > 0 ? <p className="text-muted-foreground">Banken die dit toestaan: {o.lenders.join(", ")}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export function EntrepreneurSection({ out }: { out: AdviceOutput }) {
  const e = out.entrepreneur
  if (!e) return null
  return (
    <div className="space-y-6">
      {e.businesses.map((b) => (
        <div key={b.businessId} className="space-y-4 rounded-xl border p-4">
          <h3 className="font-medium">
            {b.applicantLabel === "partner" ? "Partner" : "Aanvrager 1"}: {b.legalForm}{" "}
            <Badge variant="outline">continuïteitsrisico {b.risk.level} ({b.risk.score}/100)</Badge>
          </h3>
          {b.warnings.map((w) => (
            <p key={w} className="text-sm text-amber-800 dark:text-amber-300">{w}</p>
          ))}
          <div className="overflow-x-auto">
            <Table>
              <caption className="text-left text-sm text-muted-foreground">Toetsinkomen per geldverstrekker en rekenmethode</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead className="text-right">Toetsinkomen</TableHead>
                  <TableHead>Methode</TableHead>
                  <TableHead>Uitleg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {b.perLender.map((l) => (
                  <TableRow key={l.slug} data-testid="entrepreneur-lender-row">
                    <TableCell>{l.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.accepted === false ? "telt niet" : formatEuro(l.income)}</TableCell>
                    <TableCell className="text-xs">{l.method}</TableCell>
                    <TableCell className="max-w-md text-xs whitespace-normal text-muted-foreground">{l.explanation.join(" ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {b.analysis ? (
            <KV
              rows={[
                ["Cijfers", b.analysis.consolidated ? "geconsolideerd" : "enkelvoudig"],
                ["Winstcapaciteit (na belasting)", formatEuro(b.analysis.profitCapacity)],
                ["Solvabiliteit", `${formatPct(b.analysis.solvencyPct, 1)} (drempel ${formatPct(b.analysis.minSolvencyPct, 0)})`],
                ["Ruimte binnen solvabiliteit", formatEuro(b.analysis.maxBySolvency)],
                ["Current ratio", Number.isFinite(b.analysis.currentRatio) ? b.analysis.currentRatio.toLocaleString("nl-NL", { maximumFractionDigits: 2 }) : "n.v.t."],
                ["Ruimte binnen liquiditeit", formatEuro(b.analysis.maxByLiquidity)],
                ["Vrij uitkeerbare reserves", formatEuro(b.analysis.maxByReserves)],
                ["Duurzaam uitkeerbare winst", `${formatEuro(b.analysis.distributable)} (bepalend: ${b.analysis.limitingTest})`],
              ]}
            />
          ) : null}
          {b.salaryVsDividend ? (
            <div className="space-y-2 text-sm">
              <h4 className="font-medium">Salaris of dividend verhogen ({formatEuro(b.salaryVsDividend.delta)})</h4>
              <p>
                Extra salaris: {formatEuro(b.salaryVsDividend.salary.extraBox1Tax)} extra inkomstenbelasting, {formatEuro(b.salaryVsDividend.salary.vpbSaving)} minder Vpb: netto kosten {formatEuro(b.salaryVsDividend.salary.netCostNow)} (inclusief uitgespaarde latere box 2: {formatEuro(b.salaryVsDividend.salary.netCostInclFutureBox2)}).
              </p>
              <p>Dividend: {formatEuro(b.salaryVsDividend.dividend.box2Tax)} box 2-belasting; banken tellen dividend meestal niet extra mee.</p>
              <details>
                <summary className="cursor-pointer">Extra leenruimte per bank bij hoger salaris</summary>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {b.salaryVsDividend.perLender.map((l) => (
                    <li key={l.slug}>
                      {l.name}: +{formatEuro(l.extraIncome)} toetsinkomen, +{formatEuro(l.extraLoan)} leenruimte
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}
          {b.equityFromBv ? (
            <div className="space-y-1 text-sm">
              <h4 className="font-medium">Eigen geld uit de BV ({formatEuro(b.equityFromBv.amountNeeded)})</h4>
              <p>Dividend: bruto {formatEuro(b.equityFromBv.dividend.gross)}, waarvan {formatEuro(b.equityFromBv.dividend.box2Tax)} box 2-belasting{b.equityFromBv.dividend.solvencyAfterPct !== null ? `; solvabiliteit daarna ${formatPct(b.equityFromBv.dividend.solvencyAfterPct, 1)}` : ""}.</p>
              <p>Lenen van de BV: rente {formatEuro(b.equityFromBv.loan.annualInterest)} per jaar, netto privé {formatEuro(b.equityFromBv.loan.netAnnualCostPrivate)}; excessief lenen: {b.equityFromBv.loan.excessive.excess > 0 ? `${formatEuro(b.equityFromBv.loan.excessive.excess)} boven de drempel` : "binnen de drempel"}.</p>
            </div>
          ) : null}
          {b.ownBvMortgage ? (
            <div className="space-y-1 text-sm">
              <h4 className="font-medium">Hypotheek bij de eigen BV</h4>
              <p>
                Bank: netto {formatEuro(b.ownBvMortgage.bank.netCostYear1)} in jaar 1. Eigen BV: privé netto {formatEuro(b.ownBvMortgage.ownBv.privateNetCostYear1)}, Vpb {formatEuro(b.ownBvMortgage.ownBv.vpbOnInterest)}, box 2 bij uitkering {formatEuro(b.ownBvMortgage.ownBv.box2OnDistribution)}: netto voor privé en BV samen {formatEuro(b.ownBvMortgage.ownBv.familyNetCostYear1)}.
              </p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {b.ownBvMortgage.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {b.excessive ? (
            <p className="text-sm">
              Wet excessief lenen: {formatEuro(b.excessive.countedDebt)} telt mee (drempel {formatEuro(b.excessive.threshold)}){b.excessive.excess > 0 ? `; ${formatEuro(b.excessive.excess)} wordt belast in box 2 (${formatEuro(b.excessive.box2Tax)}).` : "."}
            </p>
          ) : null}
          {b.timing ? (
            <p className="text-sm">
              Timing: de volgende cijfers komen op {formatDate(b.timing.nextFiguresDate)}. Toetsinkomen nu {formatEuro(b.timing.incomeNow)}, daarna {formatEuro(b.timing.incomeWithNewYear)} ({b.timing.extraLoan >= 0 ? "+" : ""}{formatEuro(b.timing.extraLoan)} leenruimte). {b.timing.advice}
            </p>
          ) : null}
          {b.homeInBv ? (
            <div className="text-sm">
              <h4 className="font-medium">Woning in de BV</h4>
              <p>Overdrachtsbelasting privé {formatEuro(b.homeInBv.transferTaxPrivate)} tegenover {formatEuro(b.homeInBv.transferTaxBv)} in de BV; gemiste renteaftrek jaar 1 {formatEuro(b.homeInBv.lostDeductionYear1)}.</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {b.homeInBv.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {b.missingDocuments.length > 0 ? (
            <div className="text-sm">
              <h4 className="font-medium">Nog nodig voor een Inkomensverklaring Ondernemer</h4>
              <ul className="list-disc pl-5">
                {b.missingDocuments.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ))}
      <div className="text-sm">
        <h3 className="font-medium">Adviezen voor ondernemers</h3>
        <ul className="list-disc pl-5">
          {e.advice.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">
          Overwaarde voor de onderneming: banken die dit bevestigd toestaan: {e.businessReleaseLenders.allowed.join(", ") || "geen bekend"}. Onbekend bij: {e.businessReleaseLenders.unknown.join(", ") || "–"}.
        </p>
      </div>
    </div>
  )
}

export function NextStepsSection({ steps }: { steps: NextStep[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3 rounded-lg border p-3 text-sm">
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>
          <div>
            <p className="font-medium">
              {s.title}
              {s.date ? <span className="font-normal text-muted-foreground"> · {formatDate(s.date)}</span> : null}
            </p>
            <p className="text-muted-foreground">{s.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function ChecksSection({ out }: { out: AdviceOutput }) {
  const meta = new Map(out.assumptions.map((a) => [a.key, a]))
  return (
    <ul className="divide-y rounded-xl border" data-testid="checks">
      {out.checks.map((c) => (
        <li key={c.id} className="flex gap-3 p-3 text-sm">
          <StatusLight status={c.status} />
          <div className="space-y-0.5">
            <p className="font-medium">
              {c.label} <span className="text-xs font-normal text-muted-foreground">· {c.category}</span>
            </p>
            <p className="text-muted-foreground">{c.detail}</p>
            {c.normKeys.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Norm:{" "}
                {c.normKeys.map((k, i) => {
                  const m = meta.get(k)
                  return (
                    <span key={k}>
                      {i > 0 ? ", " : ""}
                      {m?.sourceUrl ? (
                        <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                          {m.label}
                        </a>
                      ) : (
                        (m?.label ?? k)
                      )}
                    </span>
                  )
                })}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function AssumptionsSection({ assumptions }: { assumptions: NormMeta[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <caption className="sr-only">Gebruikte parameters met bron en status</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Parameter</TableHead>
            <TableHead>Jaar</TableHead>
            <TableHead>Bron</TableHead>
            <TableHead>Gecontroleerd</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assumptions.map((a) => (
            <TableRow key={a.key} data-testid="assumption-row">
              <TableCell>
                {a.label}
                <span className="block font-mono text-xs text-muted-foreground">{a.key}</span>
              </TableCell>
              <TableCell>{a.year}</TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {a.sourceUrl ? (
                  <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                    {a.sourceName || "bron"} <ExternalLink aria-hidden className="size-3" />
                  </a>
                ) : (
                  (a.sourceName ?? "–")
                )}
              </TableCell>
              <TableCell>{a.checkedAt ? formatDate(a.checkedAt) : "–"}</TableCell>
              <TableCell>
                <StatusBadge status={a.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
