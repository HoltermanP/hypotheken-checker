import type { LtvClass, RateRow } from "@/lib/engine/lenders/types"

/**
 * Generieke parser voor rentetabellen in HTML: rijen met "N jaar" en percentages, kolommen
 * herkend aan de koptekst (NHG, ≤ 60%, …). Controleert plausibiliteit (0,5% – 12%).
 */

function clean(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;|&le;/g, "≤")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
}

function cells(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => m[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
}

export function classifyHeader(h: string): LtvClass | null {
  const s = h.toLowerCase()
  if (s.includes("nhg")) return "nhg"
  const m = /(\d{2,3})\s*%/.exec(s)
  if (!m) return null
  const pct = Number(m[1])
  if (pct <= 60) return "ltv60"
  if (pct <= 70) return "ltv70"
  if (pct <= 80) return "ltv80"
  if (pct <= 90) return "ltv90"
  return "ltv100"
}

export function parseRatePct(s: string): number | null {
  const m = /(\d{1,2})[,.](\d{1,3})\s*%?/.exec(s)
  if (!m) return null
  const v = Number(`${m[1]}.${m[2]}`)
  return v >= 0.5 && v <= 12 ? v : null
}

export function parseRateTables(html: string, opts: { lenderSlug: string; rateDate: string; sourceUrl: string; repaymentType?: RateRow["repaymentType"] }): RateRow[] {
  const out: RateRow[] = []
  const doc = clean(html)
  for (const table of doc.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const rows = [...table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) => cells(r[0]))
    const headerIdx = rows.findIndex((r) => r.filter((c) => classifyHeader(c)).length >= 2)
    if (headerIdx < 0) continue
    const header = rows[headerIdx]!.map(classifyHeader)
    for (const r of rows.slice(headerIdx + 1)) {
      const yearMatch = /(\d{1,2})\s*jaar/i.exec(r[0] ?? "")
      if (!yearMatch) continue
      const fixedYears = Number(yearMatch[1])
      r.forEach((c, i) => {
        const cls = header[i]
        const rate = i > 0 && cls ? parseRatePct(c) : null
        if (cls && rate !== null) {
          out.push({ lenderSlug: opts.lenderSlug, fixedYears, ltvClass: cls, repaymentType: opts.repaymentType ?? "annuity", ratePct: rate, rateDate: opts.rateDate, status: "verified", sourceUrl: opts.sourceUrl })
        }
      })
    }
  }
  return out
}
