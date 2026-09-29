"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ReactNode } from "react"
import { formatEuro, formatPct } from "@/lib/format"

export interface ChartRow {
  jaar: number
  schuld: number
  waarde: number
  overwaarde: number
  bruto: number
  netto: number
  renteaftrek: number
  ltv: number
}

const axis = { stroke: "var(--chart-text)", fontSize: 12, tickLine: false, axisLine: false }
const euroTick = (v: number) => (Math.abs(v) >= 1000 ? `€ ${Math.round(v / 1000)}k` : `€ ${Math.round(v)}`)
const tooltipStyle = { backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <figure className="space-y-2 rounded-xl border p-4">
      <figcaption>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </figcaption>
      <div className="h-56 w-full">{children}</div>
    </figure>
  )
}

export function AdviceCharts({ rows }: { rows: ChartRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Geen grafieken: er is geen nieuwe hypotheek.</p>
  const eur = (v: number) => formatEuro(v)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Hypotheekschuld en woningwaarde" description="Verloop per jaar over 30 jaar (waardestijging volgens prognose).">
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="jaar" {...axis} />
              <YAxis tickFormatter={euroTick} {...axis} width={56} />
              <Tooltip formatter={(v) => eur(Number(v))} labelFormatter={(l) => `Jaar ${l}`} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="schuld" name="Hypotheekschuld" stroke="var(--series-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="waarde" name="Woningwaarde" stroke="var(--series-2)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Bruto en netto maandlast" description="Gemiddeld per maand, per jaar; netto na hypotheekrenteaftrek en eigenwoningforfait.">
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="jaar" {...axis} />
              <YAxis tickFormatter={euroTick} {...axis} width={56} />
              <Tooltip formatter={(v) => eur(Number(v))} labelFormatter={(l) => `Jaar ${l}`} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="stepAfter" dataKey="bruto" name="Bruto per maand" stroke="var(--series-1)" strokeWidth={2} dot={false} />
              <Line type="stepAfter" dataKey="netto" name="Netto per maand" stroke="var(--series-2)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Hypotheekrenteaftrek" description="Belastingvoordeel per jaar (negatief = bijtelling eigenwoningforfait).">
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="jaar" {...axis} />
              <YAxis tickFormatter={euroTick} {...axis} width={56} />
              <Tooltip formatter={(v) => eur(Number(v))} labelFormatter={(l) => `Jaar ${l}`} contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="renteaftrek" name="Belastingvoordeel" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Overwaarde" description="Woningwaarde minus hypotheekschuld.">
          <ResponsiveContainer>
            <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="jaar" {...axis} />
              <YAxis tickFormatter={euroTick} {...axis} width={56} />
              <Tooltip formatter={(v) => eur(Number(v))} labelFormatter={(l) => `Jaar ${l}`} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="overwaarde" name="Overwaarde" stroke="var(--series-1)" fill="var(--series-1)" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Loan-to-value (LTV)" description="Hypotheekschuld als percentage van de woningwaarde.">
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="jaar" {...axis} />
              <YAxis tickFormatter={(v) => `${Math.round(v)}%`} {...axis} width={48} />
              <Tooltip formatter={(v) => formatPct(Number(v), 1)} labelFormatter={(l) => `Jaar ${l}`} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="ltv" name="LTV" stroke="var(--series-1)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-medium">Toon de gegevens als tabel</summary>
        <div className="mt-3 max-h-96 overflow-auto">
          <table className="w-full text-right text-xs tabular-nums">
            <caption className="sr-only">Verloop per jaar</caption>
            <thead>
              <tr className="text-muted-foreground">
                {["Jaar", "Schuld", "Waarde", "Overwaarde", "Bruto/mnd", "Netto/mnd", "Aftrek", "LTV"].map((h) => (
                  <th key={h} scope="col" className="p-1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.jaar} className="border-t">
                  <th scope="row" className="p-1 font-normal">{r.jaar}</th>
                  <td className="p-1">{eur(r.schuld)}</td>
                  <td className="p-1">{eur(r.waarde)}</td>
                  <td className="p-1">{eur(r.overwaarde)}</td>
                  <td className="p-1">{eur(r.bruto)}</td>
                  <td className="p-1">{eur(r.netto)}</td>
                  <td className="p-1">{eur(r.renteaftrek)}</td>
                  <td className="p-1">{formatPct(r.ltv, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
