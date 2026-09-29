"use client"

import { useWatch } from "react-hook-form"
import { CheckboxField, FieldGroup, MoneyField, NumberField, SelectField, TextField } from "@/components/forms/fields"
import { ENERGY_LABELS, targetHomeStep, type TargetHomeStep } from "@/lib/intake/schema"
import { WizardShell } from "../wizard-shell"
import { useStepForm } from "../use-step-form"
import type { StepProps } from "./types"

export const LABEL_OPTIONS = ENERGY_LABELS.map((l) => ({
  value: l,
  label: l === "A++++EPG" ? "A++++ met energieprestatiegarantie" : l === "geen" ? "Geen (geldig) label" : l,
}))

export function TargetHomeStepForm({ dossierId, defaults, prev, optional }: StepProps<TargetHomeStep>) {
  const { form, submit, status, serverErrors } = useStepForm(targetHomeStep, defaults, { dossierId, step: "nieuwe-woning" })
  const c = form.control
  const kind = useWatch({ control: c, name: "kind" })
  return (
    <WizardShell dossierId={dossierId} step="nieuwe-woning" prev={prev} optional={optional} status={status} serverErrors={serverErrors} onSubmit={submit} submitting={form.formState.isSubmitting}>
      <FieldGroup title="De woning">
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField control={c} name="purchasePrice" label="Koopsom" help={kind === "new_build" ? "Koopsom vrij-op-naam (v.o.n.)." : "De prijs die je betaalt (kosten koper komen erbij)."} />
          <SelectField control={c} name="kind" label="Bestaand of nieuwbouw" help="Bij nieuwbouw betaal je geen overdrachtsbelasting, wel bouwrente." options={[{ value: "existing", label: "Bestaande woning" }, { value: "new_build", label: "Nieuwbouw (v.o.n.)" }]} />
          <SelectField
            control={c}
            name="propertyType"
            label="Type woning"
            help="Voor de taxatie en onderhoudskosten."
            options={[
              { value: "appartement", label: "Appartement" },
              { value: "tussenwoning", label: "Tussenwoning" },
              { value: "hoekwoning", label: "Hoekwoning" },
              { value: "twee_onder_een_kap", label: "Twee-onder-een-kap" },
              { value: "vrijstaand", label: "Vrijstaand" },
              { value: "overig", label: "Overig" },
            ]}
          />
          <SelectField control={c} name="energyLabel" label="Energielabel" help="Een beter label geeft extra leenruimte en soms rentekorting." options={LABEL_OPTIONS} />
          <MoneyField control={c} name="marketValue" nullable label="Marktwaarde (taxatie, optioneel)" help="Laat leeg als die gelijk is aan de koopsom." />
          <MoneyField control={c} name="wozValue" nullable label="WOZ-waarde (optioneel)" help="Voor het eigenwoningforfait; standaard de marktwaarde." />
          <TextField control={c} name="deliveryDate" type="date" label="Gewenste leveringsdatum" help="Bepaalt je leeftijd bij de startersvrijstelling en de planning." />
          <MoneyField control={c} name="erfpachtCanonAnnual" label="Erfpachtcanon per jaar" help="Telt mee als woonlast in de leenruimte. Geen erfpacht: 0." />
          <MoneyField control={c} name="hoaMonthly" label="VvE-bijdrage per maand" help="Voor de begroting (appartementen)." />
        </div>
      </FieldGroup>
      {kind === "new_build" ? (
        <FieldGroup title="Nieuwbouw">
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField control={c} name="extraWork" label="Meerwerk" help="Extra opties die je laat bouwen; horen bij de financiering." />
            <NumberField control={c} name="constructionMonths" nullable label="Bouwtijd" help="Voor de schatting van de bouwrente." unit="maanden" />
          </div>
        </FieldGroup>
      ) : null}
      <FieldGroup title="Verbouwen en verduurzamen">
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField control={c} name="renovationAmount" label="Verbouwing" help="Kosten van een verbouwing die je meefinanciert." />
          <MoneyField control={c} name="energySavingAmount" label="Energiebesparende maatregelen" help="Isolatie, warmtepomp, zonnepanelen: geeft extra leenruimte tot 106% van de woningwaarde." />
        </div>
      </FieldGroup>
      <FieldGroup title="Overig">
        <CheckboxField control={c} name="ownOccupation" label="Ik ga zelf in de woning wonen" help="Vereist voor NHG, het lage overdrachtsbelastingtarief en renteaftrek." />
        <CheckboxField control={c} name="useBuildingInspection" label="Ik laat een bouwkundige keuring doen" help="Aanbevolen bij bestaande bouw." />
        <CheckboxField control={c} name="useBuyersAgent" label="Ik schakel een aankoopmakelaar in" help="Kosten komen bij de kosten koper." />
      </FieldGroup>
    </WizardShell>
  )
}
