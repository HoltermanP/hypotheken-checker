import { describe, expect, it } from "vitest"
import { signDownload, verifyDownload } from "./signed-url"

describe("ondertekende download-tokens", () => {
  it("geldig voor dezelfde gebruiker en document binnen de TTL", () => {
    const t = signDownload("doc1", "user1", 300, 1_000_000)
    expect(verifyDownload(t, "doc1", "user1", 1_000_000 + 1000)).toBe(true)
    expect(verifyDownload(t, "doc1", "user2", 1_000_000)).toBe(false)
    expect(verifyDownload(t, "doc2", "user1", 1_000_000)).toBe(false)
    expect(verifyDownload(t, "doc1", "user1", 1_000_000 + 301_000)).toBe(false)
    expect(verifyDownload("x", "doc1", "user1")).toBe(false)
    expect(verifyDownload(t.replace(/.$/, "A"), "doc1", "user1", 1_000_000)).toBe(false)
  })
})
