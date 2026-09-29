import { describe, expect, it } from "vitest"
import { decryptJson, decryptString, encryptJson, encryptString, sha256 } from "./crypto"

describe("crypto (AES-256-GCM)", () => {
  it("versleutelt en ontsleutelt tekst", () => {
    const ct = encryptString("geheim € 1.234,56")
    expect(ct.startsWith("v1.")).toBe(true)
    expect(ct).not.toContain("geheim")
    expect(decryptString(ct)).toBe("geheim € 1.234,56")
  })
  it("gebruikt een unieke IV per waarde", () => {
    expect(encryptString("x")).not.toBe(encryptString("x"))
  })
  it("round-trip voor JSON", () => {
    const v = { a: 1, b: ["x"], c: null }
    expect(decryptJson(encryptJson(v))).toEqual(v)
  })
  it("detecteert manipulatie", () => {
    const ct = encryptString("waarde")
    const parts = ct.split(".")
    parts[3] = Buffer.from("anders").toString("base64url")
    expect(() => decryptString(parts.join("."))).toThrow()
  })
  it("weigert ongeldig formaat", () => {
    expect(() => decryptString("abc")).toThrow("Ongeldig")
  })
  it("sha256 is deterministisch", () => {
    expect(sha256("a")).toBe(sha256("a"))
    expect(sha256("a")).toHaveLength(64)
  })
})
