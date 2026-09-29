/**
 * Bouwt de normen-seed (src/lib/norms/seed/norms-<jaar>.json) uit de onderzoeksbestanden in
 * /research. Draai opnieuw na het bijwerken van de research: pnpm tsx scripts/build-norm-seed.ts
 */
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { NormEntry } from "../src/lib/norms/build"

const root = path.resolve(__dirname, "..")
const read = (f: string) => JSON.parse(readFileSync(path.join(root, "research", f), "utf8"))

type RawNorm = NormEntry & { value: unknown }
const lending = read("norms-lending.json")
const fiscal = read("norms-fiscal.json")
const costs = read("norms-costs-benefits.json")

const all: RawNorm[] = [...lending.norms, ...fiscal.norms, ...costs.norms]

for (const [key, t] of Object.entries<Record<string, unknown>>(lending.tables)) {
  const m = /^trhk\.financieringslast\.(\d{4})\.(.+)$/.exec(key)
  if (!m) continue
  const year = Number(m[1])
  const kind = m[2]
  all.push({
    key: `trhk.financieringslast.${kind}`,
    year,
    value: { incomeBrackets: t.incomeBrackets, rateBrackets: t.rateBrackets, values: t.values },
    unit: "pct",
    label: `Financieringslastpercentages (${kind.replace("_", " ")})`,
    sourceName: t.sourceName as string,
    sourceUrl: t.sourceUrl as string,
    checkedAt: t.checkedAt as string,
    status: t.status as NormEntry["status"],
    note: t.note as string,
  })
}

const years = [2025, 2026]
for (const year of years) {
  const entries = new Map<string, NormEntry>()
  for (const n of all.filter((x) => x.year === year)) {
    entries.set(n.key, {
      key: n.key,
      year,
      value: n.value,
      unit: n.unit ?? null,
      label: n.label,
      sourceName: n.sourceName ?? null,
      sourceUrl: n.sourceUrl ?? null,
      checkedAt: n.checkedAt ?? null,
      status: n.status === "verified" ? "verified" : "needs_verification",
      note: n.note ?? null,
    })
  }
  // Waarden die alleen voor een ander jaar zijn onderzocht: overnemen met status needs_verification.
  for (const other of years.filter((y) => y !== year)) {
    for (const n of all.filter((x) => x.year === other)) {
      if (entries.has(n.key)) continue
      entries.set(n.key, {
        key: n.key,
        year,
        value: n.value,
        unit: n.unit ?? null,
        label: n.label,
        sourceName: n.sourceName ?? null,
        sourceUrl: n.sourceUrl ?? null,
        checkedAt: n.checkedAt ?? null,
        status: "needs_verification",
        note: `Overgenomen uit ${other}; geen aparte waarde voor ${year} onderzocht. ${n.note ?? ""}`.trim(),
      })
    }
  }
  const list = [...entries.values()].sort((a, b) => a.key.localeCompare(b.key))
  writeFileSync(path.join(root, "src/lib/norms/seed", `norms-${year}.json`), JSON.stringify(list, null, 1) + "\n")
  console.info(`norms-${year}.json: ${list.length} normen`)
}
