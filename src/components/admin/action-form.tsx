"use client"

import { useActionState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ActionResult {
  ok: boolean
  message: string
}

/** Formulier voor een server action met statusmelding (toegankelijk via role="status"). */
export function ActionForm({
  action,
  children,
  submitLabel = "Opslaan",
  className,
  variant = "default",
}: {
  action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>
  children?: ReactNode
  submitLabel?: string
  className?: string
  variant?: "default" | "outline" | "secondary"
}) {
  const [state, formAction, pending] = useActionState(action, null)
  return (
    <form action={formAction} className={cn("space-y-3", className)}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {pending ? "Bezig…" : submitLabel}
        </Button>
        {state ? (
          <p role="status" className={cn("text-sm", state.ok ? "text-green-700" : "text-destructive")}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  )
}
