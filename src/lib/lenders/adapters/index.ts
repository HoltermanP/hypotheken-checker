import type { RateRow } from "@/lib/engine/lenders/types"
import { parseRateTables } from "./html-table"
import { isAllowed, USER_AGENT } from "./robots"

/**
 * Rente-adapters per geldverstrekker. Elke adapter haalt een publieke rentepagina op (alleen als
 * robots.txt dat toestaat) en parseert die. Mislukt het, dan blijft de laatst bekende tabel staan
 * en toont de app "rente van [datum]". Pagina's veranderen regelmatig: een adapter die structureel
 * faalt, wordt in /admin zichtbaar (cron_runs) en kan handmatig worden bijgewerkt.
 */

export interface RateAdapter {
  slug: string
  url: string
  /** Minimaal aantal rijen voor een plausibel resultaat. */
  minRows: number
  parse: (html: string, ctx: { rateDate: string; url: string }) => RateRow[]
}

const table = (slug: string, url: string, minRows = 6): RateAdapter => ({
  slug,
  url,
  minRows,
  parse: (html, ctx) => parseRateTables(html, { lenderSlug: slug, rateDate: ctx.rateDate, sourceUrl: ctx.url }),
})

/**
 * Adapters voor banken met een publieke HTML-rentepagina (bronnen uit het onderzoek, zie
 * docs/LENDERS.md). Banken die alleen pdf-rentebladen publiceren, worden via /admin bijgewerkt.
 */
export const ADAPTERS: RateAdapter[] = [
  table("argenta", "https://www.argenta.nl/hypotheek-argenta/hypotheekrente-overzicht"),
  table("lot", "https://www.lothypotheken.nl/consument/hypotheek/hypotheekrentes"),
  table("munt", "https://www.munthypotheken.nl/rente/"),
  table("lloyds-bank", "https://www.lloydsbank.nl/hypotheken/actuele-rentes-hypotheken"),
  table("de-volksbank", "https://www.asnbank.nl/hypotheek/hypotheekrentes.html"),
]

export interface AdapterResult {
  slug: string
  ok: boolean
  rows: RateRow[]
  error?: string
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

export async function runAdapter(adapter: RateAdapter, rateDate: string, fetcher: Fetcher = fetch): Promise<AdapterResult> {
  try {
    const u = new URL(adapter.url)
    const robots = await fetcher(`${u.origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) })
    if (robots.ok && !isAllowed(await robots.text(), u.pathname)) {
      return { slug: adapter.slug, ok: false, rows: [], error: "robots.txt staat ophalen niet toe" }
    }
    const res = await fetcher(adapter.url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return { slug: adapter.slug, ok: false, rows: [], error: `HTTP ${res.status}` }
    const rows = adapter.parse(await res.text(), { rateDate, url: adapter.url })
    if (rows.length < adapter.minRows) return { slug: adapter.slug, ok: false, rows: [], error: `te weinig rentes herkend (${rows.length})` }
    return { slug: adapter.slug, ok: true, rows }
  } catch (err) {
    return { slug: adapter.slug, ok: false, rows: [], error: (err as Error).name }
  }
}
