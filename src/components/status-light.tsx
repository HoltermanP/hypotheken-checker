import { cn } from "@/lib/utils"

const LABEL = { green: "Groen: in orde", orange: "Oranje: aandachtspunt", red: "Rood: probleem" } as const

/** Stoplicht met tekstalternatief (kleur is nooit de enige drager van informatie). */
export function StatusLight({ status, className }: { status: "green" | "orange" | "red"; className?: string }) {
  return (
    <span className={cn("mt-0.5 inline-flex shrink-0 items-center gap-1", className)}>
      <span
        aria-hidden
        className={cn(
          "inline-block size-3 rounded-full",
          status === "green" ? "bg-green-600" : status === "orange" ? "bg-amber-500" : "bg-red-600"
        )}
      />
      <span className="sr-only">{LABEL[status]}</span>
    </span>
  )
}
