/**
 * Herleidbaarheid: elke berekende uitkomst krijgt een trace-regel met de gebruikte formule, de
 * invoerwaarden en de normsleutels (bronnen). Het adviesrapport en de anti-hallucinatiecheck
 * gebruiken deze trace.
 */

export interface TraceEntry {
  /** Unieke id, bijv. "capacity.income.maxLoan" */
  id: string
  label: string
  value: number
  unit: "EUR" | "EUR/maand" | "EUR/jaar" | "%" | "maanden" | "jaren" | "factor" | "aantal"
  formula: string
  inputs?: Record<string, number | string | boolean | null>
  normKeys?: string[]
}

export class Tracer {
  constructor(
    private readonly prefix = "",
    private readonly entries: TraceEntry[] = []
  ) {}

  /** Voegt een regel toe en geeft de waarde terug (handig inline). */
  add(entry: TraceEntry): number {
    this.entries.push({ ...entry, id: this.prefix ? `${this.prefix}.${entry.id}` : entry.id })
    return entry.value
  }

  /** Tracer met extra prefix die in dezelfde lijst schrijft. */
  child(prefix: string): Tracer {
    return new Tracer(this.prefix ? `${this.prefix}.${prefix}` : prefix, this.entries)
  }

  list(): TraceEntry[] {
    return this.entries
  }
}
