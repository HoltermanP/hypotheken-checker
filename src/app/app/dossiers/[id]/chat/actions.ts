"use server"

import { revalidatePath } from "next/cache"
import { AuthError, requireUserId } from "@/lib/auth"
import { RateLimitError } from "@/lib/rate-limit"
import { audit } from "@/lib/services/audit"
import { ChatUnavailableError, sendChat } from "@/lib/services/chat"

export async function sendChatAction(dossierId: string, question: string): Promise<{ ok: true; answer: string } | { ok: false; error: string }> {
  try {
    const userId = await requireUserId()
    const answer = await sendChat(userId, dossierId, question)
    await audit({ userId, action: "chat", entityType: "dossier", entityId: dossierId, dossierId })
    revalidatePath(`/app/dossiers/${dossierId}/chat`)
    return { ok: true, answer }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "Je sessie is verlopen." }
    if (err instanceof RateLimitError) return { ok: false, error: `Je hebt het maximum aantal vragen bereikt. Probeer het over ${Math.ceil(err.retryAfterSeconds / 60)} minuten opnieuw.` }
    if (err instanceof ChatUnavailableError) return { ok: false, error: err.message }
    console.error("Chat mislukt:", (err as Error).name)
    return { ok: false, error: "De assistent kon je vraag nu niet beantwoorden. Probeer het later opnieuw." }
  }
}
