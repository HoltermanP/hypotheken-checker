"use client"

import { Bot, Loader2, Send, User } from "lucide-react"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { sendChatAction } from "@/app/app/dossiers/[id]/chat/actions"
import { cn } from "@/lib/utils"

interface Msg {
  id: string
  role: "user" | "assistant"
  content: string
}

const SUGGESTIONS = [
  "Waarom kan ik bij de ene bank minder lenen dan bij de andere?",
  "Wat is de beperkende factor voor mijn maximale hypotheek?",
  "Hoe kan ik mijn leenruimte vergroten?",
  "Welke risico's moet ik afdekken?",
]

/** Maakt URL's in antwoorden klikbaar (als tekst; geen HTML uit het model). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g)
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer noopener" className="break-all underline">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  )
}

export function Chat({ dossierId, initial }: { dossierId: string; initial: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initial)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const send = (q: string) => {
    if (!q.trim()) return
    setError(null)
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", content: q }])
    setText("")
    start(async () => {
      const r = await sendChatAction(dossierId, q)
      if (r.ok) setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", content: r.answer }])
      else setError(r.error)
    })
  }
  return (
    <div className="space-y-4">
      <ol aria-live="polite" aria-label="Gesprek" className="space-y-3">
        {messages.length === 0 ? (
          <li className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Stel een vraag over je berekening. De assistent antwoordt alleen op basis van je dossier en noemt de bron.
          </li>
        ) : null}
        {messages.map((m) => (
          <li key={m.id} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "")}>
            {m.role === "assistant" ? <Bot aria-hidden className="mt-1 size-5 shrink-0 text-primary" /> : null}
            <div className={cn("max-w-[85%] rounded-xl px-4 py-2 text-sm whitespace-pre-wrap", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
              <span className="sr-only">{m.role === "user" ? "Jij: " : "Assistent: "}</span>
              {m.role === "assistant" ? <Linkified text={m.content} /> : m.content}
            </div>
            {m.role === "user" ? <User aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" /> : null}
          </li>
        ))}
        {pending ? (
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 animate-spin" /> De assistent denkt na…
          </li>
        ) : null}
      </ol>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <Button key={s} type="button" size="sm" variant="outline" className="h-auto whitespace-normal" disabled={pending} onClick={() => send(s)}>
            {s}
          </Button>
        ))}
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
        }}
      >
        <Label htmlFor="vraag">Je vraag</Label>
        <Textarea
          id="vraag"
          value={text}
          rows={3}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send(text)
            }
          }}
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          <Send aria-hidden /> Versturen
        </Button>
      </form>
    </div>
  )
}
