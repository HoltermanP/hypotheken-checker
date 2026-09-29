"use client"

import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, useWatch } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { CheckboxField, FieldGroup, MoneyField, NumberField, SelectField, TextField } from "@/components/forms/fields"
import { newId } from "@/lib/intake/defaults"
import { currentHomeStep, type CurrentHomeStep } from "@/lib/intake/schema"
import { WizardShell } from "../wizard-shell"
import { useStepForm } from "../use-step-form"
import { LABEL_OPTIONS } from "./target-home-step"
import type { StepProps } from "./types"

export function CurrentHomeStepForm({ dossierId, defaults, prev, context }: StepProps<CurrentHomeStep>) {
  const { form, submit, status, serverErrors } = useStepForm(currentHomeStep, defaults, { dossierId, step: "huidige-woning" })
  const c = form.control
  const { fields, append, remove } = useFieldArray({ control: c, name: "loanParts" })
  const order = useWatch({ control: c, name: "moveOrder" })
  const mover = context.goal === "doorstromer"
  return (
    <WizardShell dossierId={dossierId} step="huidige-woning" prev={prev} status={status} serverErrors={serverErrors} onSubmit={submit} submitting={form.formState.isSubmitting}>
      <FieldGroup title="Je huidige woning">
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField control={c} name="wozValue" label="WOZ-waarde" help="Staat op je WOZ-beschikking; bepaalt het eigenwoningforfait." />
          <MoneyField control={c} name="marketValue" label="Geschatte marktwaarde" help="Voor de LTV en de overwaarde." />
          <MoneyField control={c} name="expectedSalePrice" label={mover || context.goal === "verkopen" ? "Verwachte verkoopprijs" : "Verwachte verkoopprijs (optioneel)"} help="Bepaalt je overwaarde of restschuld." />
          <SelectField control={c} name="energyLabel" label="Energielabel" options={LABEL_OPTIONS} help="Voor extra leenruimte en rentekorting." />
          <MoneyField control={c} name="erfpachtCanonAnnual" label="Erfpachtcanon per jaar" help="Geen erfpacht: 0." />
          {mover || context.goal === "verkopen" ? (
            <>
              <TextField control={c} name="expectedSaleDate" type="date" label="Verwachte verkoopdatum" help="Voor overbrugging en dubbele lasten." />
              <NumberField control={c} name="brokerFeePct" nullable label="Makelaarscourtage (optioneel)" step={0.01} unit="%" help="Leeg = landelijk gemiddelde." />
            </>
          ) : null}
        </div>
      </FieldGroup>
      <FieldGroup title="Huidige hypotheekdelen" description="Staat op je jaaroverzicht van de bank. Per leningdeel de soort, restschuld en rente.">
        {fields.map((f, i) => (
          <div key={f.id} className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                control={c}
                name={`loanParts.${i}.type`}
                label="Soort"
                options={[
                  { value: "annuity", label: "Annuïtair" },
                  { value: "linear", label: "Lineair" },
                  { value: "interest_only", label: "Aflossingsvrij" },
                  { value: "savings", label: "Spaarhypotheek" },
                  { value: "investment", label: "Beleggingshypotheek" },
                ]}
              />
              <MoneyField control={c} name={`loanParts.${i}.balance`} label="Restschuld" />
              <NumberField control={c} name={`loanParts.${i}.ratePct`} label="Rente" step={0.01} unit="%" />
              <TextField control={c} name={`loanParts.${i}.fixedRateEndDate`} type="date" label="Einde rentevaste periode" help="Voor boeterente en renteherziening." />
              <TextField control={c} name={`loanParts.${i}.endDate`} type="date" label="Einddatum looptijd" />
              <TextField control={c} name={`loanParts.${i}.lender`} label="Bank (optioneel)" />
              <MoneyField control={c} name={`loanParts.${i}.originalPrincipal`} nullable label="Oorspronkelijke hoofdsom" help="Voor de boetevrije ruimte." />
              <NumberField control={c} name={`loanParts.${i}.penaltyFreePct`} nullable label="Boetevrij aflossen per jaar" unit="%" help="Meestal 10–20%." />
              <MoneyField control={c} name={`loanParts.${i}.accruedValue`} nullable label="Opgebouwde waarde (spaar/beleggen)" />
            </div>
            <CheckboxField control={c} name={`loanParts.${i}.startedBefore2013`} label="Afgesloten vóór 1 januari 2013" help="Dan geldt het overgangsrecht: ook aflossingsvrij blijft aftrekbaar." />
            <CheckboxField control={c} name={`loanParts.${i}.nhg`} label="Met NHG" />
            {mover ? <CheckboxField control={c} name={`loanParts.${i}.portOnMove`} label="Meenemen naar de nieuwe woning (meeneemregeling)" help="Je houdt dan de huidige rente en voorwaarden." /> : null}
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
              <Trash2 aria-hidden /> Leningdeel verwijderen
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({ id: newId(), type: "annuity", balance: 0, ratePct: 0, fixedRateEndDate: "", endDate: "", startedBefore2013: false, nhg: false, lender: "", originalPrincipal: null, penaltyFreePct: 10, portOnMove: false, accruedValue: null })
          }
        >
          <Plus aria-hidden /> Leningdeel toevoegen
        </Button>
      </FieldGroup>
      {mover ? (
        <FieldGroup title="Verhuizen">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField control={c} name="moveOrder" label="Eerst kopen of eerst verkopen?" help="Eerst kopen: overbruggingskrediet en dubbele lasten. Eerst verkopen: tijdelijk wonen." options={[{ value: "sell_first", label: "Eerst verkopen" }, { value: "buy_first", label: "Eerst kopen" }]} />
            {order === "buy_first" ? (
              <NumberField control={c} name="bridgeMonths" label="Verwachte overbruggingsduur" unit="maanden" help="Hoe lang je twee woningen hebt." />
            ) : (
              <>
                <MoneyField control={c} name="temporaryHousingMonthly" label="Tijdelijke woonlasten per maand" help="Bijvoorbeeld huur als je tussen twee woningen zit." />
                <NumberField control={c} name="temporaryHousingMonths" label="Aantal maanden" unit="maanden" />
              </>
            )}
          </div>
        </FieldGroup>
      ) : null}
    </WizardShell>
  )
}
