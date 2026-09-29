import { describe, expect, it } from "vitest"
import { formatDate, formatEuro, formatMonths, formatNumber, formatPct, parseEuroInput } from "./format"

describe("format nl-NL", () => {
  it("formatteert bedragen", () => {
    expect(formatEuro(1234.56, 2)).toBe("€ 1.234,56")
    expect(formatEuro(350000)).toBe("€ 350.000")
    expect(formatEuro(-1500)).toMatch(/1\.500/)
    expect(formatEuro(Number.NaN)).toBe("–")
  })
  it("formatteert getallen en procenten", () => {
    expect(formatNumber(1234.5, 1)).toBe("1.234,5")
    expect(formatPct(4.1)).toBe("4,10%")
    expect(formatPct(Number.POSITIVE_INFINITY)).toBe("–")
    expect(formatNumber(Number.NaN)).toBe("–")
  })
  it("formatteert datums en looptijden", () => {
    expect(formatDate("2026-09-29")).toBe("29 september 2026")
    expect(formatDate("onzin")).toBe("–")
    expect(formatMonths(14)).toBe("1 jaar en 2 maanden")
    expect(formatMonths(24)).toBe("2 jaar")
    expect(formatMonths(1)).toBe("1 maand")
    expect(formatMonths(13)).toBe("1 jaar en 1 maand")
  })
  it("parset invoer", () => {
    expect(parseEuroInput("€ 1.234,56")).toBe(1234.56)
    expect(parseEuroInput("350.000")).toBe(350000)
    expect(parseEuroInput("1234.5")).toBe(1234.5)
    expect(parseEuroInput("")).toBeNull()
    expect(parseEuroInput("abc")).toBeNull()
  })
})
