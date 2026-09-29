import "server-only"
import { and, asc, eq } from "drizzle-orm"
import { answerChat } from "@/lib/ai/chat"
import { getDb, schema } from "@/lib/db/client"
import { aiRateLimit, enforceRateLimit } from "@/lib/rate-limit"
import { latestCalculation } from "./advice"
import { getOwnedDossier } from "./dossiers"

export async function listChat(userId: string, dossierId: string) {
  await getOwnedDossier(userId, dossierId)
  const rows = await getDb()
    .select()
    .from(schema.chatMessages)
    .where(and(eq(schema.chatMessages.dossierId, dossierId), eq(schema.chatMessages.userId, userId)))
    .orderBy(asc(schema.chatMessages.createdAt))
  return rows.map((r) => ({ id: r.id, role: r.role as "user" | "assistant", content: r.content, createdAt: r.createdAt.toISOString() }))
}

export class ChatUnavailableError extends Error {}

export async function sendChat(userId: string, dossierId: string, question: string) {
  const q = question.trim().slice(0, 2000)
  if (!q) throw new ChatUnavailableError("Stel een vraag.")
  const calc = await latestCalculation(userId, dossierId)
  if (!calc) throw new ChatUnavailableError("Bereken eerst je advies; de assistent beantwoordt vragen over je berekening.")
  await enforceRateLimit("ai-chat", userId, aiRateLimit())
  const history = await listChat(userId, dossierId)
  const answer = await answerChat(calc.output, history.map((h) => ({ role: h.role, content: h.content })), q)
  const db = getDb()
  await db.insert(schema.chatMessages).values({ dossierId, userId, role: "user", content: q })
  await db.insert(schema.chatMessages).values({ dossierId, userId, role: "assistant", content: answer })
  return answer
}
