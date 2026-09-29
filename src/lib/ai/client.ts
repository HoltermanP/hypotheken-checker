import "server-only"
import Anthropic from "@anthropic-ai/sdk"

/** Anthropic-client, of null als er geen API-sleutel is (de app valt dan terug op handmatig/templates). */
let client: Anthropic | null | undefined

export function getAnthropic(): Anthropic | null {
  if (client !== undefined) return client
  client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 }) : null
  return client
}

/** Model voor extractie en chat (instelbaar via ANTHROPIC_MODEL). */
export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5"
}

/** Model voor de adviesteksten van het eindrapport (instelbaar via ANTHROPIC_MODEL_REPORT). */
export function reportModel(): string {
  return process.env.ANTHROPIC_MODEL_REPORT || aiModel()
}
