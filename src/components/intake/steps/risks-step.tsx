"use client"

import { FieldGroup, MoneyField, SelectField } from "@/components/forms/fields"
import { risksStep, type RisksStep } from "@/lib/intake/schema"
import { WizardShell } from "../wizard-shell"
import { useStepForm } from "../use-step-form"
import type { StepProps } from "./types"

export function RisksStepForm({ dossierId, defaults, prev, context }: StepProps<RisksStep>) {
  const { form, submit, status, serverErrors } = useStepForm(risksStep, defaults, { dossierId, step: "risicos" })
  const c = form.control
  return (
    <WizardShell dossierId={dossierId} step="risicos" prev={prev} status={status} serverErrors={serverErrors} onSubmit={submit} submitting={form.formState.isSubmitting}>
      {defaults.applicants.map((_, i) => (
        <FieldGroup key={i} title={context.names[i] ?? (i === 0 ? "Jij" : "Partner")} description="Voor de stresstests: wat gebeurt er als het tegenzit?">
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField control={c} name={`applicants.${i}.aovMonthlyBenefit`} nullable label="Uitkering arbeidsongeschiktheidsverzekering per maand" help="Vooral voor ondernemers (AOV) of een WIA-hiaatverzekering. Geen: leeg laten." />
            <MoneyField control={c} name={`applicants.${i}.orvCoverage`} nullable label="Verzekerd bedrag overlijdensrisicoverzekering" help="Lost bij overlijden (een deel van) de hypotheek af." />
            <MoneyField control={c} name={`applicants.${i}.survivorPensionAnnual`} nullable label="Nabestaandenpensioen voor je partner per jaar" help="Staat op mijnpensioenoverzicht.nl." />
            <SelectField control={c} name={`applicants.${i}.unemploymentRisk`} label="Kans op werkloosheid" help="Je eigen inschatting." options={[{ value: "low", label: "Laag" }, { value: "medium", label: "Gemiddeld" }, { value: "high", label: "Hoog" }]} />
            <SelectField control={c} name={`applicants.${i}.incomeOutlook`} label="Verwacht inkomensverloop" help="Stijgend, stabiel of dalend in de komende jaren." options={[{ value: "rising", label: "Stijgend" }, { value: "stable", label: "Stabiel" }, { value: "falling", label: "Dalend" }]} />
          </div>
        </FieldGroup>
      ))}
      <FieldGroup title="Overige vaste lasten">
        <MoneyField control={c} name="otherFixedCostsMonthly" nullable label="Overige vaste lasten per maand (optioneel)" help="Bijvoorbeeld kinderopvang, auto, abonnementen. Voor de betaalbaarheidstoets." />
      </FieldGroup>
    </WizardShell>
  )
}
