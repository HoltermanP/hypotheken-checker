/**
 * Genereert docs/NORMS-2026.md en docs/LENDERS.md uit de seed, zodat documentatie en data
 * niet uit elkaar lopen. Draai: pnpm tsx scripts/generate-docs.ts
 */
import { writeFileSync } from "node:fs"
import path from "node:path"
import { SEED_ENTRIES } from "../src/lib/norms"
import { SEED_LENDERS, SEED_RATES } from "../src/lib/lenders"
import { CRITERIA_LABELS, profileToRows } from "../src/lib/lenders/profile-kv"

const root = path.resolve(__dirname, "..")
const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ")

function valueText(v: unknown): string {
  if (v === null || v === undefined) return "onbekend"
  if (typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("incomeBrackets" in o) {
      const t = o as { incomeBrackets: unknown[]; rateBrackets: unknown[] }
      return `tabel: ${t.incomeBrackets.length} inkomensrijen × ${t.rateBrackets.length} toetsrentekolommen`
    }
    const s = JSON.stringify(v)
    return s.length > 160 ? `${s.slice(0, 160)}…` : s
  }
  const s = String(v)
  return s.length > 160 ? `${s.slice(0, 160)}…` : s
}

function normsDoc(year: number): string {
  const entries = [...SEED_ENTRIES[year]!].sort((a, b) => a.key.localeCompare(b.key))
  const other = SEED_ENTRIES[year - 1] ?? []
  const unverified = entries.filter((e) => e.status !== "verified")
  const groups = new Map<string, typeof entries>()
  for (const e of entries) {
    const g = e.key.split(".")[0]!
    groups.set(g, [...(groups.get(g) ?? []), e])
  }
  const names: Record<string, string> = {
    trhk: "Leencapaciteit (Trhk / Nibud)",
    nhg: "Nationale Hypotheek Garantie",
    nibud: "Nibud (begroting en buffer)",
    box1: "Box 1",
    ewf: "Eigenwoningforfait",
    hillen: "Wet Hillen",
    ew: "Eigen woning (fiscaal)",
    ahk: "Heffingskortingen",
    ak: "Heffingskortingen",
    ovb: "Overdrachtsbelasting",
    box3: "Box 3",
    schenk: "Schenkbelasting",
    ib: "Ondernemers (IB)",
    box2: "Box 2",
    vpb: "Vennootschapsbelasting",
    dga: "DGA",
    lijfrente: "Lijfrente",
    aow: "Sociale zekerheid",
    anw: "Sociale zekerheid",
    wml: "Sociale zekerheid",
    ww: "Sociale zekerheid",
    wia: "Sociale zekerheid",
    aov: "Ondernemers (IB)",
    kk: "Kosten koper",
    vk: "Verkoopkosten",
    markt: "Marktaannames",
    boeterente: "Boeterente",
    senioren: "Senioren",
  }
  let out = `# Normen en parameters ${year}\n\n`
  out += `> Automatisch gegenereerd uit \`src/lib/norms/seed/norms-${year}.json\` met \`pnpm tsx scripts/generate-docs.ts\`.\n`
  out += `> Bijwerken gebeurt via /admin (database) of door de research in \`/research\` aan te passen en de seed opnieuw te bouwen.\n\n`
  out += `- Aantal parameters: **${entries.length}**\n- Geverifieerd bij de primaire bron: **${entries.length - unverified.length}**\n- Nog te verifiëren (needs_verification): **${unverified.length}**\n\n`
  out += `Waarden met status *te verifiëren* worden in de app en in het rapport zichtbaar gemarkeerd. Kosten koper, verkoopkosten en een deel van de Nibud-bedragen zijn **schattingen**: de app gebruikt de typische waarde uit de gevonden bandbreedte en de gebruiker kan ze aanpassen.\n\n`
  out += `## Nog te verifiëren\n\n| Sleutel | Omschrijving | Toelichting |\n|---|---|---|\n`
  for (const e of unverified) out += `| \`${e.key}\` | ${esc(e.label)} | ${esc(e.note ?? "")} |\n`
  const seen = new Set<string>()
  for (const [g, list] of groups) {
    const title = names[g] ?? g
    if (!seen.has(title)) {
      out += `\n## ${title}\n\n| Sleutel | Omschrijving | Waarde ${year} | ${year - 1} | Status | Bron | Gecontroleerd |\n|---|---|---|---|---|---|---|\n`
      seen.add(title)
    }
    for (const e of list) {
      const prev = other.find((o) => o.key === e.key)
      const src = e.sourceUrl ? `[${esc(e.sourceName ?? "bron")}](${e.sourceUrl})` : esc(e.sourceName ?? "–")
      out += `| \`${e.key}\` | ${esc(e.label)} | ${esc(valueText(e.value))} | ${prev ? esc(valueText(prev.value)) : "–"} | ${e.status === "verified" ? "geverifieerd" : "**te verifiëren**"} | ${src} | ${e.checkedAt ?? "–"} |\n`
    }
  }
  return out
}

function lendersDoc(): string {
  let out = `# Geldverstrekkers\n\n`
  out += `> Automatisch gegenereerd uit \`src/lib/lenders/seed/\` met \`pnpm tsx scripts/generate-docs.ts\`. Onderzoek: september 2026 (zie \`/research/lenders-*.json\` voor de volledige brontekst per veld).\n\n`
  const active = SEED_LENDERS.filter((l) => l.active)
  out += `- Opgenomen: **${SEED_LENDERS.length}** geldverstrekkers, waarvan **${active.length}** actief voor nieuwe hypotheken.\n`
  out += `- Rentes: **${SEED_RATES.length}** tariefregels (bank × rentevaste periode × LTV-klasse × aflossingsvorm).\n`
  out += `- Onbekende criteria staan op *onbekend* (null). De engine behandelt onbekend als "niet uitgesloten, met voorbehoud" en toont dat in de acceptatiereden.\n\n`
  out += `## Niet (meer) actief\n\n`
  for (const l of SEED_LENDERS.filter((x) => !x.active)) out += `- **${l.name}**: ${esc(l.activeNote ?? "geen nieuwe hypotheken")}\n`
  out += `\n## Overzicht rentes\n\n| Geldverstrekker | Rentedatum | Status | Bron |\n|---|---|---|---|\n`
  for (const l of active) {
    const rows = SEED_RATES.filter((r) => r.lenderSlug === l.slug)
    const date = rows.reduce<string | null>((m, r) => (!m || r.rateDate > m ? r.rateDate : m), null)
    const statuses = [...new Set(rows.map((r) => r.status))].join(", ")
    const src = rows[0]?.sourceUrl
    out += `| ${l.name} | ${date ?? "–"} | ${statuses || "–"} | ${src ? `[link](${src})` : "–"} |\n`
  }
  for (const l of active) {
    const { criteria, entrepreneur } = profileToRows(l)
    out += `\n## ${l.name}\n\n| Criterium | Waarde | Status | Bron |\n|---|---|---|---|\n`
    for (const r of [...criteria, ...entrepreneur]) {
      out += `| ${CRITERIA_LABELS[r.key] ?? r.key} | ${esc(valueText(r.value))} | ${r.status === "verified" ? "geverifieerd" : r.status === "unknown" ? "onbekend" : "te verifiëren"} | ${r.sourceUrl ? `[bron](${r.sourceUrl})` : "–"} |\n`
    }
  }
  return out
}

writeFileSync(path.join(root, "docs/NORMS-2026.md"), normsDoc(2026))
writeFileSync(path.join(root, "docs/LENDERS.md"), lendersDoc())
console.info("docs/NORMS-2026.md en docs/LENDERS.md bijgewerkt")
