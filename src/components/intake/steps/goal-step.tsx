"use client"

import { Controller } from "react-hook-form"
import { goalStep, type GoalStep } from "@/lib/intake/schema"
import { TextField } from "@/components/forms/fields"
import { WizardShell } from "../wizard-shell"
import { useStepForm } from "../use-step-form"
import type { StepProps } from "./types"
import { cn } from "@/lib/utils"
import { GOAL_OPTIONS } from "@/lib/intake/goals"



export function GoalStepForm({ dossierId, defaults, prev }: StepProps<GoalStep>) {
  const { form, submit, status, serverErrors } = useStepForm(goalStep, defaults, { dossierId, step: "doel" })
  return (
    <WizardShell dossierId={dossierId} step="doel" prev={prev} status={status} serverErrors={serverErrors} onSubmit={submit} submitting={form.formState.isSubmitting}>
      <Controller
        control={form.control}
        name="goal"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 font-medium">Wat wil je doen?</legend>
            <p className="mb-3 text-sm text-muted-foreground">Je doel bepaalt welke vragen we stellen en welke berekeningen we maken.</p>
            <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
              {GOAL_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-xl border p-4 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                    field.value === o.value && "border-primary bg-primary/5"
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input type="radio" name="goal" value={o.value} checked={field.value === o.value} onChange={() => field.onChange(o.value)} className="accent-[var(--primary)]" />
                    {o.label}
                  </span>
                  <span className="text-sm text-muted-foreground">{o.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      />
      <TextField control={form.control} name="title" label="Naam van dit dossier (optioneel)" help="Handig als je meerdere dossiers hebt, bijvoorbeeld 'Appartement Utrecht'." />
    </WizardShell>
  )
}
