"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form"
import type { z } from "zod"
import { saveDraftAction, saveStepAction } from "@/app/app/dossiers/[id]/intake/actions"
import type { StepKey } from "@/lib/intake/schema"

export type SaveStatus = "idle" | "saving" | "saved" | "error"

/**
 * Formulier voor één wizardstap: validatie met Zod, automatisch opslaan als concept (na 1,5 s
 * zonder wijzigingen) en bij "Volgende" genormaliseerd opslaan en doorgaan.
 */
export function useStepForm<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  defaults: z.input<S>,
  opts: { dossierId: string; step: Exclude<StepKey, "overzicht"> }
) {
  const router = useRouter()
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never) as never,
    defaultValues: defaults as DefaultValues<z.input<S>>,
    mode: "onBlur",
  })
  const [status, setStatus] = useState<SaveStatus>("idle")
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(async () => {
          setStatus("saving")
          const r = await saveDraftAction(opts.dossierId, opts.step, values)
          setStatus(r.ok ? "saved" : "error")
        }, 1500)
      },
    })
    return () => {
      unsubscribe()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [form, opts.dossierId, opts.step])

  const onValid = async (values: z.output<S>) => {
    if (timer.current) clearTimeout(timer.current)
    setStatus("saving")
    setServerErrors([])
    const r = await saveStepAction(opts.dossierId, opts.step, values)
    if (!r.ok) {
      setStatus("error")
      setServerErrors(r.errors)
      return
    }
    setStatus("saved")
    router.push(`/app/dossiers/${opts.dossierId}/intake/${r.next ?? "overzicht"}`)
  }
  // handleSubmit pas aanroepen in de event handler (niet tijdens render).
  const submit = () => form.handleSubmit(onValid)()

  return { form, submit, status, serverErrors }
}
