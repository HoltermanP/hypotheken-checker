"use client"

import { useState, useTransition } from "react"
import { Calculator, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { calculateAction } from "@/app/app/dossiers/[id]/intake/actions"

export function CalculateButton({ dossierId, disabled }: { dossierId: string; disabled?: boolean }) {
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<string[]>([])
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const r = await calculateAction(dossierId)
            if (r && !r.ok) setErrors(r.errors)
          })
        }
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Calculator aria-hidden />}
        Bereken mijn advies
      </Button>
      {errors.length > 0 ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  )
}
