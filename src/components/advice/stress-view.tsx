import { Lightbulb } from "lucide-react"
import { StatusLight } from "@/components/status-light"
import type { StressResult } from "@/lib/engine"
import { formatMetric } from "./format"

export function StressView({ results }: { results: StressResult[] }) {
  if (results.length === 0) return <p className="text-sm text-muted-foreground">Geen stresstests: er is geen nieuwe hypotheek.</p>
  const counts = { green: 0, orange: 0, red: 0 }
  for (const r of results) counts[r.light]++
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {counts.green} groen, {counts.orange} oranje, {counts.red} rood.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {results.map((r) => (
          <li key={r.key} className="space-y-2 rounded-xl border p-4" data-testid="stress-result">
            <p className="flex items-start gap-2 font-medium">
              <StatusLight status={r.light} /> {r.label}
            </p>
            <dl className="space-y-1 text-sm">
              {r.metrics.map((m) => (
                <div key={m.label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{m.label}</dt>
                  <dd className="text-right tabular-nums">{formatMetric(m.value, m.unit)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">{r.explanation}</p>
            {r.tips.map((t) => (
              <p key={t} className="flex gap-2 text-sm">
                <Lightbulb aria-hidden className="size-4 shrink-0 text-primary" /> {t}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}
