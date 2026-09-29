import { describe, expect, it } from "vitest"
import { classifyHeader, parseRatePct, parseRateTables } from "./html-table"
import { runAdapter, type RateAdapter } from "./index"
import { isAllowed } from "./robots"

const HTML = `<html><body><table>
<tr><th>Rentevast</th><th>NHG</th><th>t/m 60%</th><th>t/m 80%</th><th>t/m 100%</th></tr>
<tr><td>5 jaar</td><td>3,95%</td><td>4,01%</td><td>4,10%</td><td>4,25%</td></tr>
<tr><td>10 jaar</td><td>4,10%</td><td>4,15 %</td><td>4,20%</td><td>n.v.t.</td></tr>
<tr><td>Toelichting</td><td colspan="4">geen</td></tr>
</table></body></html>`

describe("rente-adapters", () => {
  it("parset een HTML-rentetabel", () => {
    const rows = parseRateTables(HTML, { lenderSlug: "x", rateDate: "2026-09-29", sourceUrl: "https://x" })
    expect(rows).toHaveLength(7)
    expect(rows.find((r) => r.fixedYears === 10 && r.ltvClass === "ltv60")!.ratePct).toBe(4.15)
    expect(classifyHeader("NHG-rente")).toBe("nhg")
    expect(classifyHeader("≤ 90%")).toBe("ltv90")
    expect(classifyHeader("106%")).toBe("ltv100")
    expect(classifyHeader("Looptijd")).toBeNull()
    expect(parseRatePct("45,00%")).toBeNull()
    expect(parseRatePct("n.v.t.")).toBeNull()
  })
  it("respecteert robots.txt", () => {
    const robots = "User-agent: *\nDisallow: /hypotheek/\nAllow: /hypotheek/rente\n\nUser-agent: hypotheekchecknl-ratebot\nDisallow: /"
    expect(isAllowed("User-agent: *\nDisallow: /hypotheek/\nAllow: /hypotheek/rente", "/hypotheek/rente")).toBe(true)
    expect(isAllowed("User-agent: *\nDisallow: /hypotheek/", "/hypotheek/x")).toBe(false)
    expect(isAllowed(robots, "/anything")).toBe(false)
    expect(isAllowed("", "/x")).toBe(true)
    expect(isAllowed("User-agent: *\nDisallow: /*.pdf$", "/a.pdf")).toBe(false)
  })
  it("adapter: succes, robots-blokkade, HTTP-fout en te weinig rijen", async () => {
    const adapter: RateAdapter = { slug: "x", url: "https://bank.test/rente", minRows: 3, parse: (html, c) => parseRateTables(html, { lenderSlug: "x", rateDate: c.rateDate, sourceUrl: c.url }) }
    const ok = await runAdapter(adapter, "2026-09-29", async (url) => new Response(url.endsWith("robots.txt") ? "User-agent: *\nAllow: /" : HTML))
    expect(ok.ok).toBe(true)
    const blocked = await runAdapter(adapter, "2026-09-29", async (url) => new Response(url.endsWith("robots.txt") ? "User-agent: *\nDisallow: /" : HTML))
    expect(blocked.error).toMatch(/robots/)
    const http = await runAdapter(adapter, "2026-09-29", async (url) => (url.endsWith("robots.txt") ? new Response("", { status: 404 }) : new Response("x", { status: 503 })))
    expect(http.error).toBe("HTTP 503")
    const few = await runAdapter({ ...adapter, minRows: 50 }, "2026-09-29", async () => new Response(HTML))
    expect(few.ok).toBe(false)
    const thrown = await runAdapter(adapter, "2026-09-29", async () => {
      throw new TypeError("netwerk")
    })
    expect(thrown.error).toBe("TypeError")
  })
})
