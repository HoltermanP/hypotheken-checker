import { Document, Link, Page, Polyline, StyleSheet, Svg, Text, View, Line as SvgLine } from "@react-pdf/renderer"
import type { ComponentProps, ReactNode } from "react"
import { DISCLAIMER_TEXT } from "@/components/disclaimer-text"
import type { NextStep } from "@/lib/advice/next-steps"
import type { AdviceTexts } from "@/lib/advice/template"
import type { AdviceOutput, ScenarioSummary } from "@/lib/engine"
import { formatDate, formatEuro, formatPct } from "@/lib/format"

/**
 * PDF-adviesrapport. Zelfde inhoud en getallen als het dashboard; tekens buiten de standaard
 * PDF-lettertypen (Helvetica) worden vervangen.
 */

export function pdfText(s: string): string {
  return s
    .replace(/↔/g, "vs.")
    .replace(/→/g, "->")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/×/g, "x")
    .replace(/[^\u0000-ÿ€–—…‘’“”•·]/g, "")
}

const colors = { primary: "#1f5fae", muted: "#555555", border: "#dddddd", green: "#1a7f37", orange: "#b35c00", red: "#c62828", s1: "#2a78d6", s2: "#eb6834" }

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 64, paddingHorizontal: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111111", lineHeight: 1.35 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", color: colors.primary, marginBottom: 8, lineHeight: 1.2 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: colors.primary, marginTop: 14, marginBottom: 6 },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
  muted: { color: colors.muted },
  text: { marginBottom: 4 },
  box: { backgroundColor: "#f4f6f9", padding: 8, borderRadius: 4, marginBottom: 6 },
  kpis: { flexDirection: "row", gap: 6, marginVertical: 6 },
  kpi: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 4, padding: 6 },
  kpiValue: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingVertical: 2 },
  th: { fontFamily: "Helvetica-Bold" },
  cell: { flex: 1, paddingRight: 4 },
  right: { textAlign: "right" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7, color: colors.muted },
})

type PdfStyle = ComponentProps<typeof View>["style"]

function T({ children, style }: { children: string; style?: PdfStyle }) {
  return <Text style={style}>{pdfText(children)}</Text>
}

function Table({ head, rows, widths }: { head: string[]; rows: string[][]; widths?: number[] }) {
  const w = (i: number) => ({ flex: widths?.[i] ?? 1 })
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={[s.row, { borderBottomWidth: 1 }]} fixed>
        {head.map((h, i) => (
          <T key={i} style={[s.cell, s.th, w(i), i > 0 ? s.right : {}]}>{h}</T>
        ))}
      </View>
      {rows.map((r, j) => (
        <View key={j} style={s.row} wrap={false}>
          {r.map((c, i) => (
            <T key={i} style={[s.cell, w(i), i > 0 ? s.right : {}]}>{c}</T>
          ))}
        </View>
      ))}
    </View>
  )
}

function KV({ rows }: { rows: [string, string][] }) {
  return <Table head={["Onderdeel", "Waarde"]} rows={rows} widths={[2, 1]} />
}

function LineChart({ title, series, labels }: { title: string; series: { name: string; color: string; values: number[] }[]; labels: number[] }) {
  const W = 500
  const H = 110
  const all = series.flatMap((x) => x.values)
  const max = Math.max(1, ...all)
  const min = Math.min(0, ...all)
  const x = (i: number) => (i / Math.max(1, labels.length - 1)) * W
  const y = (v: number) => H - ((v - min) / (max - min)) * H
  return (
    <View wrap={false} style={{ marginBottom: 8 }}>
      <T style={s.h3}>{title}</T>
      <Svg width={W} height={H + 4}>
        <SvgLine x1={0} y1={y(0)} x2={W} y2={y(0)} strokeWidth={0.5} stroke={colors.border} />
        {series.map((ser) => (
          <Polyline key={ser.name} points={ser.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} stroke={ser.color} strokeWidth={1.5} fill="none" />
        ))}
      </Svg>
      <T style={s.muted}>
        {`${series.map((ser) => `${ser.name} (${ser.color === colors.s1 ? "blauw" : "oranje"}): van ${formatEuro(ser.values[0] ?? 0)} naar ${formatEuro(ser.values.at(-1) ?? 0)}`).join(" · ")} · ${labels[0]}–${labels.at(-1)} · max. ${formatEuro(max)}`}
      </T>
    </View>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <T style={s.h2}>{title}</T>
      {children}
    </View>
  )
}

const light = (l: string) => (l === "green" ? "groen" : l === "orange" ? "oranje" : "rood")

export function ReportDocument({
  title,
  out,
  texts,
  textSource,
  scenarios,
  steps,
  generatedAt,
}: {
  title: string
  out: AdviceOutput
  texts: AdviceTexts
  textSource: "llm" | "template"
  scenarios: ScenarioSummary[]
  steps: NextStep[]
  generatedAt: string
}) {
  const years = out.loan.years
  const labels = years.map((y) => y.calendarYear)
  const txt = (k: keyof AdviceTexts) => (texts[k] ? <View style={s.box}><T>{texts[k]!}</T></View> : null)
  return (
    <Document title={`Hypotheekadvies – ${title}`} author="HypotheekCheck NL" language="nl">
      <Page size="A4" style={s.page}>
        <Text style={s.footer} fixed>
          {pdfText(DISCLAIMER_TEXT)}
        </Text>
        <T style={s.h1}>Indicatief hypotheekadvies</T>
        <T style={s.muted}>{`${title} · opgesteld op ${formatDate(generatedAt)} · rekenkern ${out.engineVersion} · normen ${out.normSetVersion}`}</T>
        <View style={[s.box, { marginTop: 8, backgroundColor: "#fff4e5" }]}>
          <T style={s.th}>Disclaimer</T>
          <T>{DISCLAIMER_TEXT}</T>
        </View>

        <Section title="Samenvatting">
          <View style={s.kpis}>
            {[
              ["Maximale hypotheek", formatEuro(out.summary.maxMortgage)],
              ["Verstandig om te lenen", formatEuro(out.summary.prudentLoan)],
              ["Bruto maandlast", formatEuro(out.summary.grossMonthly)],
              ["Netto maandlast", formatEuro(out.summary.netMonthly)],
            ].map(([k, v]) => (
              <View key={k} style={s.kpi}>
                <T style={s.muted}>{k!}</T>
                <T style={s.kpiValue}>{v!}</T>
              </View>
            ))}
          </View>
          {txt("samenvatting")}
          <T style={s.muted}>
            {textSource === "llm" ? "Toelichtingen geschreven met AI op basis van de berekening; alle getallen automatisch gecontroleerd." : "Standaardtoelichtingen op basis van de berekening."}
          </T>
        </Section>

        <Section title="Maximale hypotheek">
          {txt("maximaleHypotheek")}
          <KV
            rows={[
              ["Toetsinkomen", formatEuro(out.capacity.income.combinedIncome)],
              ["Toetsrente", formatPct(out.capacity.income.toetsrentePct)],
              ["Financieringslastpercentage", formatPct(out.capacity.income.financieringslastPct, 1)],
              ["Maximaal op inkomen", formatEuro(out.capacity.income.maxLoan)],
              ["Maximaal op onderpand", out.capacity.collateral ? formatEuro(out.capacity.collateral.maxLoan) : "n.v.t."],
              ["Beperkende factor", out.capacity.limiting],
              ...out.capacity.levers.filter((l) => l.extraLoan > 0).map((l) => [`Knop: ${l.label}`, `+ ${formatEuro(l.extraLoan)}`] as [string, string]),
            ]}
          />
        </Section>

        <Section title="Financieringsopzet">
          {txt("financiering")}
          {out.purchase ? (
            <>
              <Table head={["Benodigd", "Bedrag"]} rows={[...out.purchase.uses.map((u) => [u.label, formatEuro(u.amount)]), ["Totaal", formatEuro(out.purchase.totalUses)]]} widths={[2, 1]} />
              <Table head={["Bronnen", "Bedrag"]} rows={[...out.purchase.sources.map((u) => [u.label, formatEuro(u.amount)]), ["Tekort eigen geld", formatEuro(out.purchase.shortfall)]]} widths={[2, 1]} />
              <Table head={["Kosten koper", "Bedrag"]} rows={out.purchase.costs.lines.map((l) => [l.label + (l.deductible ? " (aftrekbaar)" : ""), formatEuro(l.amount)])} widths={[2, 1]} />
            </>
          ) : null}
          {out.mover ? (
            <KV
              rows={[
                ["Verkoopprijs", formatEuro(out.mover.salePrice)],
                ["Verkoopkosten", formatEuro(out.mover.saleCosts.total)],
                ["Overwaarde", formatEuro(out.mover.netProceeds)],
                ["Eigenwoningreserve", formatEuro(out.mover.eigenwoningreserve)],
              ]}
            />
          ) : null}
          <Table
            head={["Leningdeel", "Bedrag", "Rente", "Rentevast", "Aftrekbaar"]}
            rows={out.loan.parts.map((p) => [p.label, formatEuro(p.principal), formatPct(p.ratePct), `${p.fixedYears} jaar`, p.deductible ? "ja" : "nee"])}
            widths={[2.5, 1, 1, 1, 1]}
          />
          {out.budget ? (
            <KV rows={[["Netto-inkomen per maand", formatEuro(out.budget.netIncomeMonthly)], ...out.budget.lines.map((l) => [l.label, formatEuro(l.monthly)] as [string, string]), ["Vrij besteedbaar", formatEuro(out.budget.remaining)]]} />
          ) : null}
        </Section>

        {scenarios.length > 0 ? (
          <Section title="Scenariovergelijking">
            <Table
              head={["Uitkomst", ...scenarios.map((x) => x.name)]}
              rows={[
                ["Hypotheek", ...scenarios.map((x) => formatEuro(x.loanAmount))],
                ["Rente", ...scenarios.map((x) => formatPct(x.ratePct))],
                ["NHG", ...scenarios.map((x) => (x.nhg ? "ja" : "nee"))],
                ["Bruto per maand", ...scenarios.map((x) => formatEuro(x.grossMonthly))],
                ["Netto per maand", ...scenarios.map((x) => formatEuro(x.netMonthly))],
                ["Netto rentekosten 10 jaar", ...scenarios.map((x) => formatEuro(x.netCost10))],
                ["Tekort", ...scenarios.map((x) => formatEuro(x.shortfall))],
              ]}
              widths={[1.6, ...scenarios.map(() => 1)]}
            />
          </Section>
        ) : null}

        {years.length > 0 ? (
          <Section title="Grafieken">
            <LineChart title="Hypotheekschuld en woningwaarde" labels={labels} series={[{ name: "Schuld", color: colors.s1, values: years.map((y) => y.balanceEnd) }, { name: "Woningwaarde", color: colors.s2, values: years.map((y) => y.propertyValue) }]} />
            <LineChart title="Bruto en netto maandlast" labels={labels} series={[{ name: "Bruto", color: colors.s1, values: years.map((y) => y.grossMonthly) }, { name: "Netto", color: colors.s2, values: years.map((y) => y.netMonthly) }]} />
            <LineChart title="Hypotheekrenteaftrek per jaar" labels={labels} series={[{ name: "Belastingvoordeel", color: colors.s1, values: years.map((y) => y.taxBenefit) }]} />
            <LineChart title="Overwaarde" labels={labels} series={[{ name: "Overwaarde", color: colors.s1, values: years.map((y) => y.equity) }]} />
            <T style={s.muted}>{`LTV: van ${formatPct(years[0]!.ltvPct, 1)} in ${labels[0]} naar ${formatPct(years.at(-1)!.ltvPct, 1)} in ${labels.at(-1)}.`}</T>
          </Section>
        ) : null}

        <Section title="Bankadvies">
          {txt("bankadvies")}
          <Table
            head={["Bank", "Acceptatie", "Leenruimte", "Rente", "Rente van", "Netto/mnd", "Totale kosten"]}
            rows={out.lenders.rows.map((r) => [
              `${r.rank}. ${r.name}`,
              r.accepted === false ? "nee" : !r.fits ? "past niet" : r.accepted === null ? "voorbehoud" : "ja",
              formatEuro(r.maxLoan),
              r.ratePct !== null ? formatPct(r.ratePct) : "–",
              r.rateDate ? formatDate(r.rateDate) : "–",
              r.netMonthlyYear1 !== null ? formatEuro(r.netMonthlyYear1) : "–",
              r.totalCostsFixedPeriod !== null ? formatEuro(r.totalCostsFixedPeriod) : "–",
            ])}
            widths={[1.8, 0.9, 1, 0.7, 1.1, 0.9, 1]}
          />
        </Section>

        <Section title="Risicoanalyse">
          {txt("risico")}
          {out.stress.map((r) => (
            <View key={r.key} wrap={false} style={{ marginBottom: 4 }}>
              <T style={s.th}>{`${r.label}: ${light(r.light)}`}</T>
              <T>{r.explanation}</T>
              {r.tips.map((t) => (
                <T key={t} style={s.muted}>{`Tip: ${t}`}</T>
              ))}
            </View>
          ))}
        </Section>

        {out.equityRelease ? (
          <Section title="Overwaarde benutten">
            {txt("overwaarde")}
            <Table
              head={["Optie", "Bedrag", "Per maand", "10 jaar", "30 jaar"]}
              rows={out.equityRelease.options.filter((o) => o.available).map((o) => [o.title, formatEuro(o.amount), formatEuro(o.monthlyEffect), formatEuro(o.netEffect10), formatEuro(o.netEffect30)])}
              widths={[2, 1, 1, 1, 1]}
            />
          </Section>
        ) : null}

        {out.entrepreneur ? (
          <Section title="Ondernemers">
            {txt("ondernemer")}
            {out.entrepreneur.businesses.map((b) => (
              <View key={b.businessId}>
                <T style={s.h3}>{`${b.legalForm} · continuïteitsrisico ${b.risk.level} (${b.risk.score}/100)`}</T>
                <Table head={["Bank", "Toetsinkomen", "Methode"]} rows={b.perLender.map((l) => [l.name, l.accepted === false ? "telt niet" : formatEuro(l.income), l.method])} widths={[1.5, 1, 1.5]} />
                {b.analysis ? (
                  <KV
                    rows={[
                      ["Winstcapaciteit", formatEuro(b.analysis.profitCapacity)],
                      ["Solvabiliteit", formatPct(b.analysis.solvencyPct, 1)],
                      ["Uitkeerbare winst", `${formatEuro(b.analysis.distributable)} (${b.analysis.limitingTest})`],
                    ]}
                  />
                ) : null}
                {b.missingDocuments.length > 0 ? <T style={s.muted}>{`Nog nodig voor een IVO: ${b.missingDocuments.join("; ")}`}</T> : null}
              </View>
            ))}
            {out.entrepreneur.advice.map((a) => (
              <T key={a}>{`• ${a}`}</T>
            ))}
          </Section>
        ) : null}

        <Section title="Checklist en tijdlijn">
          {steps.map((st, i) => (
            <T key={st.title}>{`${i + 1}. ${st.title}${st.date ? ` (${formatDate(st.date)})` : ""}: ${st.detail}`}</T>
          ))}
        </Section>

        <Section title="Gecheckt op">
          <Table head={["Toets", "Resultaat", "Toelichting"]} rows={out.checks.map((c) => [`${c.label} (${c.category})`, light(c.status), c.detail])} widths={[1.6, 0.5, 2.4]} />
        </Section>

        <Section title="Aannames en bronnen">
          {out.assumptions.map((a) => (
            <View key={a.key} style={s.row} wrap={false}>
              <T style={[s.cell, { flex: 2 }]}>{`${a.label} (${a.year})`}</T>
              <View style={[s.cell, { flex: 2 }]}>
                {a.sourceUrl ? (
                  <Link src={a.sourceUrl}>
                    <T>{a.sourceName ?? "bron"}</T>
                  </Link>
                ) : (
                  <T>{a.sourceName ?? "–"}</T>
                )}
              </View>
              <T style={[s.cell, s.right]}>{a.status === "verified" ? "geverifieerd" : "te verifiëren"}</T>
            </View>
          ))}
        </Section>
      </Page>
    </Document>
  )
}
