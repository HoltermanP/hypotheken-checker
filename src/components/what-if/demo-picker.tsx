"use client"

import { useState } from "react"
import type { EngineContext } from "@/lib/engine"
import type { EngineInput } from "@/lib/engine/types"
import { cn } from "@/lib/utils"
import { WhatIf } from "./what-if"

export function DemoPicker({ profiles, ctx }: { profiles: { key: string; title: string; description: string; input: EngineInput }[]; ctx: EngineContext }) {
  const [key, setKey] = useState(profiles[0]!.key)
  const current = profiles.find((p) => p.key === key)!
  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Kies een voorbeeld" className="grid gap-3 sm:grid-cols-3">
        {profiles.map((p) => (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={p.key === key}
            onClick={() => setKey(p.key)}
            className={cn("rounded-xl border p-4 text-left text-sm focus-visible:ring-3 focus-visible:ring-ring/50", p.key === key && "border-primary bg-primary/5")}
          >
            <span className="block font-medium">{p.title}</span>
            <span className="text-muted-foreground">{p.description}</span>
          </button>
        ))}
      </div>
      <WhatIf key={key} input={current.input} ctx={ctx} />
    </div>
  )
}
