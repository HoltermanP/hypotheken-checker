import Link from "next/link"
import { Check } from "lucide-react"
import type { StepMeta } from "@/lib/intake/steps"
import { cn } from "@/lib/utils"

export function Stepper({ dossierId, steps, current, completed }: { dossierId: string; steps: StepMeta[]; current: string; completed: string[] }) {
  const idx = steps.findIndex((s) => s.key === current)
  return (
    <nav aria-label="Stappen van de intake">
      <p className="mb-2 text-sm text-muted-foreground">
        Stap {idx + 1} van {steps.length}
      </p>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={idx + 1} aria-label="Voortgang">
        <div className="h-full bg-primary transition-all" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => {
          const done = completed.includes(s.key)
          const active = s.key === current
          return (
            <li key={s.key}>
              <Link
                href={`/app/dossiers/${dossierId}/intake/${s.key}`}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                  active ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary/40 text-foreground" : "text-muted-foreground"
                )}
              >
                {done && !active ? <Check aria-hidden className="size-3" /> : <span aria-hidden>{i + 1}.</span>}
                {s.title}
                {done && !active ? <span className="sr-only"> (klaar)</span> : null}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
