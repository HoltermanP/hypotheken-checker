"use client"

import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, useWatch, type Control } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckboxField, FieldGroup, MoneyField, NumberField, SelectField, TextField } from "@/components/forms/fields"
import { newId } from "@/lib/intake/defaults"
import { obligationsStep, type ObligationsStep } from "@/lib/intake/schema"
import { WizardShell } from "../wizard-shell"
import { useStepForm } from "../use-step-form"
import type { StepProps } from "./types"

function ObligationFields({ control, i, hasPartner }: { control: Control<ObligationsStep>; i: number; hasPartner: boolean }) {
  const type = useWatch({ control, name: `obligations.${i}.type` })
  const reduced = useWatch({ control, name: `obligations.${i}.studentLoanReducedPhase` })
  const p = `obligations.${i}` as const
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        control={control}
        name={`${p}.type`}
        label="Soort"
        options={[
          { value: "revolving_credit", label: "Doorlopend krediet / creditcard" },
          { value: "personal_loan", label: "Persoonlijke lening" },
          { value: "private_lease", label: "Private lease" },
          { value: "student_loan", label: "Studieschuld (DUO)" },
          { value: "alimony_partner", label: "Partneralimentatie (betaald)" },
          { value: "other", label: "Overig" },
        ]}
      />
      <TextField control={control} name={`${p}.description`} label="Omschrijving (optioneel)" />
      {hasPartner ? (
        <SelectField control={control} name={`${p}.applicantPosition`} numeric label="Op naam van" options={[{ value: 1, label: "Aanvrager 1" }, { value: 2, label: "Partner" }]} />
      ) : null}
      {type === "revolving_credit" || type === "personal_loan" ? (
        <MoneyField control={control} name={`${p}.limitOrPrincipal`} label={type === "revolving_credit" ? "Kredietlimiet" : "Oorspronkelijke hoofdsom"} help="Telt voor 2% per maand mee, ook als je het krediet niet gebruikt." />
      ) : null}
      <MoneyField control={control} name={`${p}.monthlyPayment`} label="Maandtermijn" help={type === "student_loan" ? "Actuele termijn volgens Mijn DUO. Wordt gewogen met een factor (1,05–1,40)." : "Wat je nu per maand betaalt."} />
      <MoneyField control={control} name={`${p}.outstanding`} label="Openstaande schuld" help="Resterend bedrag." />
      {type === "student_loan" ? (
        <>
          <CheckboxField control={control} name={`${p}.studentLoanReducedPhase`} label="Ik zit in de aanloopfase, een aflosvrije periode of betaal minder door draagkracht" help="Dan rekenen we de termijn uit op basis van restschuld, rente en looptijd." />
          {reduced ? (
            <>
              <NumberField control={control} name={`${p}.studentLoanRatePct`} label="Rente studieschuld" step={0.01} unit="%" />
              <NumberField control={control} name={`${p}.studentLoanRemainingMonths`} label="Resterende looptijd" unit="maanden" />
            </>
          ) : null}
        </>
      ) : null}
      <CheckboxField control={control} name={`${p}.willBeRepaid`} label="Deze lening los ik af (en zeg ik op) vóór de hypotheek" help="Dan telt hij niet mee in de leenruimte." />
    </div>
  )
}

export function ObligationsStepForm({ dossierId, defaults, prev, context }: StepProps<ObligationsStep>) {
  const { form, submit, status, serverErrors } = useStepForm(obligationsStep, defaults, { dossierId, step: "verplichtingen" })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "obligations" })
  return (
    <WizardShell dossierId={dossierId} step="verplichtingen" prev={prev} status={status} serverErrors={serverErrors} onSubmit={submit} submitting={form.formState.isSubmitting}>
      <p className="text-sm text-muted-foreground">
        Leningen en lease verlagen je leenruimte. Twijfel je? Vraag gratis je BKR-overzicht op via bkr.nl (inloggen met DigiD) en je studieschuld via Mijn DUO.
      </p>
      {fields.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Geen verplichtingen. Voeg er een toe als je die wel hebt.</p> : null}
      {fields.map((f, i) => (
        <FieldGroup key={f.id} title={`Verplichting ${i + 1}`}>
          <ObligationFields control={form.control} i={i} hasPartner={context.hasPartner} />
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
            <Trash2 aria-hidden /> Verwijderen
          </Button>
        </FieldGroup>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => append({ id: newId(), applicantPosition: 1, type: "revolving_credit", description: "", limitOrPrincipal: 0, monthlyPayment: 0, outstanding: 0, willBeRepaid: false })}
      >
        <Plus aria-hidden /> Verplichting toevoegen
      </Button>
      <div className="space-y-1.5">
        <Label htmlFor="bkr">BKR-registraties (optioneel)</Label>
        <Textarea id="bkr" rows={3} {...form.register("bkrRegistrations")} aria-describedby="bkr-help" />
        <p id="bkr-help" className="text-xs text-muted-foreground">
          Staat er een achterstandscodering (A) op je BKR? Beschrijf het kort; banken beoordelen dit apart.
        </p>
      </div>
    </WizardShell>
  )
}
