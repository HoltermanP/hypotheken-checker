"use client"

import { useDeferredValue, useId, useMemo, useState } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { Button } from "@/components/ui/button"
import { runAdvice, type EngineContext } from "@/lib/engine"
import type { EngineInput } from "@/lib/engine/types"
import { formatEuro, formatPct } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Wat-als-modus: de rekenkern draait in de browser (isomorf) en rekent direct opnieuw bij elke
 * wijziging. Er gaat niets naar de server.
 */

interface Knobs {
  purchasePrice: number
  ratePct: number
  ownFunds: number
  termYears: number
  salePrice: number
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  help,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format: (v: number) => string
  help?: string
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <output htmlFor={id} className="text-sm tabular-nums">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]"
        aria-valuetext={format(value)}
        aria-describedby={help ? `${id}-help` : undefined}
      />
      {help ? (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  )
}

function Metric({ label, value, base, invert = false, testId }: { label: string; value: number; base: number; invert?: boolean; testId?: string }) {
  const diff = value - base
  const better = invert ? diff < 0 : diff > 0
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums" data-testid={testId}>
        {formatEuro(value)}
      </p>
      {Math.abs(diff) >= 1 ? (
        <p className={cn("text-xs", better ? "text-green-700 dark:text-green-400" : "text-amber-800 dark:text-amber-300")}>
          {diff > 0 ? "+" : "−"}
          {formatEuro(Math.abs(diff))} t.o.v. je berekening
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">gelijk aan je berekening</p>
      )}
    </div>
  )
}

export function WhatIf({ input, ctx }: { input: EngineInput; ctx: EngineContext }) {
  const initial: Knobs = {
    purchasePrice: input.targetProperty?.purchasePrice ?? 0,
    ratePct: input.referenceRatePct,
    ownFunds: input.assets.ownFundsToContribute ?? Math.max(0, input.assets.savings + input.assets.investments - input.assets.desiredBuffer),
    termYears: Math.round((input.preferences.termMonths ?? 360) / 12),
    salePrice: input.currentProperty?.expectedSalePrice ?? 0,
  }
  const [knobs, setKnobs] = useState(initial)
  const deferred = useDeferredValue(knobs)
  const set = (k: keyof Knobs) => (v: number) => setKnobs((s) => ({ ...s, [k]: v }))

  const base = useMemo(() => runAdvice(input, ctx), [input, ctx])
  const result = useMemo(() => {
    const next: EngineInput = structuredClone(input)
    if (next.targetProperty) next.targetProperty.purchasePrice = deferred.purchasePrice
    if (next.currentProperty) next.currentProperty.expectedSalePrice = deferred.salePrice
    next.referenceRatePct = deferred.ratePct
    next.assets.ownFundsToContribute = deferred.ownFunds
    next.preferences.termMonths = deferred.termYears * 12
    return runAdvice(next, ctx)
  }, [deferred, input, ctx])

  const maxOwn = input.assets.savings + input.assets.investments
  const chart = result.loan.years.map((y) => ({ jaar: y.calendarYear, netto: Math.round(y.netMonthly), bruto: Math.round(y.grossMonthly) }))
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
      <div className="space-y-5 rounded-xl border p-4">
        <h2 className="font-semibold">Pas aan</h2>
        {input.targetProperty ? (
          <RangeField label="Koopsom" value={knobs.purchasePrice} min={Math.round(initial.purchasePrice * 0.5)} max={Math.round(initial.purchasePrice * 1.5) || 1_000_000} step={5000} onChange={set("purchasePrice")} format={(v) => formatEuro(v)} />
        ) : null}
        <RangeField label="Hypotheekrente" value={knobs.ratePct} min={2} max={8} step={0.05} onChange={set("ratePct")} format={(v) => formatPct(v)} help="Bij minder dan 10 jaar rentevast wordt getoetst op minimaal de AFM-toetsrente." />
        <RangeField label="Eigen geld inbrengen" value={knobs.ownFunds} min={0} max={Math.max(maxOwn, 1000)} step={1000} onChange={set("ownFunds")} format={(v) => formatEuro(v)} />
        <RangeField label="Looptijd" value={knobs.termYears} min={10} max={30} step={1} onChange={set("termYears")} format={(v) => `${v} jaar`} help="De leenruimte wordt altijd getoetst op 30 jaar; de looptijd beïnvloedt je maandlast." />
        {input.currentProperty ? (
          <RangeField label="Verkoopprijs huidige woning" value={knobs.salePrice} min={Math.round(initial.salePrice * 0.7)} max={Math.round(initial.salePrice * 1.3) || 1_000_000} step={5000} onChange={set("salePrice")} format={(v) => formatEuro(v)} />
        ) : null}
        <Button type="button" variant="outline" onClick={() => setKnobs(initial)}>
          Terug naar je berekening
        </Button>
      </div>
      <div className="space-y-4" aria-live="polite">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Maximale hypotheek" value={result.summary.maxMortgage} base={base.summary.maxMortgage} testId="wi-max" />
          <Metric label="Hypotheekbedrag" value={result.loan.amount} base={base.loan.amount} />
          <Metric label="Tekort eigen geld" value={result.summary.shortfall} base={base.summary.shortfall} invert />
          <Metric label="Bruto maandlast" value={result.summary.grossMonthly} base={base.summary.grossMonthly} invert testId="wi-gross" />
          <Metric label="Netto maandlast" value={result.summary.netMonthly} base={base.summary.netMonthly} invert />
          <Metric label="Verstandig om te lenen" value={result.prudent.loan} base={base.prudent.loan} />
        </div>
        <p className="text-sm text-muted-foreground">
          {result.lenders.top3.length > 0
            ? `Voordeligste bank bij deze instellingen: ${result.lenders.top3[0]!.name} (${formatPct(result.lenders.top3[0]!.ratePct ?? 0)}).`
            : "Bij deze instellingen accepteert geen bank het leenbedrag."}{" "}
          Rode stresstests: {result.stress.filter((s) => s.light === "red").length}.
        </p>
        <figure className="rounded-xl border p-4">
          <figcaption className="text-sm font-medium">Netto en bruto maandlast per jaar</figcaption>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="jaar" stroke="var(--chart-text)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--chart-text)" fontSize={12} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `€ ${v}`} />
                <Tooltip formatter={(v) => formatEuro(Number(v))} labelFormatter={(l) => `Jaar ${l}`} contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="stepAfter" dataKey="bruto" name="Bruto" stroke="var(--series-1)" strokeWidth={2} dot={false} />
                <Line type="stepAfter" dataKey="netto" name="Netto" stroke="var(--series-2)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </div>
    </div>
  )
}
