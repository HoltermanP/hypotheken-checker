import { Disclaimer } from "@/components/disclaimer"
import { Chat } from "@/components/chat/chat"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { listChat } from "@/lib/services/chat"

export const metadata = { title: "Vraag het" }

export default async function ChatPage({ params }: PageProps<"/app/dossiers/[id]/chat">) {
  const { id } = await params
  const userId = await requireUserIdOrRedirect()
  const messages = await listChat(userId, id)
  return (
    <div className="space-y-6">
      <Chat dossierId={id} initial={messages} />
      <Disclaimer />
    </div>
  )
}
