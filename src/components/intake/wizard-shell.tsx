"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import { skipStepAction } from "@/app/app/dossiers/[id]/intake/actions"
import type { StepKey } from "@/lib/intake/schema"
import type { SaveStatus } from "./use-step-form"

export function WizardShell({
  dossierId,
  step,
  prev,
  optional,
  status,
  serverErrors,
  onSubmit,
  submitting,
  children,
}: {
  dossierId: string
  step: StepKey
  prev: StepKey | null
  optional?: boolean
  status: SaveStatus
  serverErrors: string[]
  onSubmit: () => void
  submitting: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const [skipping, startSkip] = useTransition()
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-6"
    >
      {children}
      {serverErrors.length > 0 ? (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <p className="font-medium">Controleer de volgende velden:</p>
          <ul className="mt-1 list-disc pl-5">
            {serverErrors.slice(0, 8).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        {prev ? (
          <Link href={`/app/dossiers/${dossierId}/intake/${prev}`} className={buttonVariants({ variant: "outline" })}>
            Vorige
          </Link>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Opslaan en verder
        </Button>
        {optional ? (
          <Button
            type="button"
            variant="ghost"
            disabled={skipping}
            onClick={() =>
              startSkip(async () => {
                const r = await skipStepAction(dossierId, step)
                if (r.ok) router.push(`/app/dossiers/${dossierId}/intake/${r.next ?? "overzicht"}`)
              })
            }
          >
            Overslaan
          </Button>
        ) : null}
        <p aria-live="polite" className="ml-auto text-xs text-muted-foreground">
          {status === "saving" ? "Opslaan…" : status === "saved" ? "Automatisch opgeslagen" : status === "error" ? "Niet opgeslagen" : ""}
        </p>
      </div>
    </form>
  )
}
