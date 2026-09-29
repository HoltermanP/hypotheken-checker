/**
 * Minimale robots.txt-parser: mag onze user-agent dit pad ophalen? Gebruikt de groep voor onze
 * agent of anders "*", en de langste overeenkomende Allow/Disallow-regel.
 */
export const USER_AGENT = "HypotheekCheckNL-RateBot/1.0 (+https://github.com/; contact via site)"

export function isAllowed(robotsTxt: string, path: string, agent = "hypotheekchecknl-ratebot"): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = []
  let current: (typeof groups)[number] | null = null
  let lastWasAgent = false
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim()
    if (!line) continue
    const [k, ...rest] = line.split(":")
    const key = k!.trim().toLowerCase()
    const value = rest.join(":").trim()
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
    } else if ((key === "allow" || key === "disallow") && current) {
      lastWasAgent = false
      if (value) current.rules.push({ allow: key === "allow", path: value })
    } else {
      lastWasAgent = false
    }
  }
  const pick = groups.find((g) => g.agents.some((a) => a !== "*" && agent.toLowerCase().includes(a))) ?? groups.find((g) => g.agents.includes("*"))
  if (!pick) return true
  const matches = pick.rules
    .filter((r) => {
      const pattern = "^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")
      return new RegExp(pattern).test(path)
    })
    .sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow))
  return matches.length === 0 ? true : matches[0]!.allow
}
