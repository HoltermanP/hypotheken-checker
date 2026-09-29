"use client"

import { useEffect } from "react"
import { useWatch } from "react-hook-form"
import { CheckboxField, FieldGroup, NumberField, SelectField, TextField } from "@/components/forms/fields"
import { personalStep, type PersonalStep } from "@/lib/intake/schema"
import { WizardShell } from "../wizard-shell"
import { useStepForm } from "../use-step-form"
import type { StepProps } from "./types"

export function PersonalStepForm({ dossierId, defaults, prev }: StepProps<PersonalStep>) {
  const { form, submit, status, serverErrors } = useStepForm(personalStep, defaults, { dossierId, step: "persoonlijk" })
  const hasPartner = useWatch({ control: form.control, name: "hasPartner" })
  const applicants = useWatch({ control: form.control, name: "applicants" })
  useEffect(() => {
    const list = form.getValues("applicants")
    if (hasPartner && list.length < 2) {
      form.setValue("applicants", [...list, { firstName: "", dateOfBirth: "", previousHomeOwner: false, usedStartersExemption: false, yearsWorked: null }])
    }
    if (!hasPartner && list.length > 1) form.setValue("applicants", list.slice(0, 1))
  }, [hasPartner, form])
  return (
    <WizardShell dossierId={dossierId} step="persoonlijk" prev={prev} status={status} serverErrors={serverErrors} onSubmit={submit} submitting={form.formState.isSubmitting}>
      <CheckboxField
        control={form.control}
        name="hasPartner"
        label="Ik koop samen met een partner (medeaanvrager)"
        help="Het inkomen van je partner telt volledig mee in de leenruimte."
      />
      {(applicants ?? []).slice(0, hasPartner ? 2 : 1).map((_, i) => (
        <FieldGroup key={i} title={i === 0 ? "Jij" : "Je partner"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name={`applicants.${i}.firstName`} label="Voornaam (optioneel)" help="Alleen om het rapport persoonlijk te maken." autoComplete={i === 0 ? "given-name" : "off"} />
            <TextField control={form.control} name={`applicants.${i}.dateOfBirth`} type="date" label="Geboortedatum" help="Nodig voor de AOW-toets, de startersvrijstelling (jonger dan 35) en de looptijd." />
            <NumberField control={form.control} name={`applicants.${i}.yearsWorked`} label="Aantal jaren gewerkt (optioneel)" help="Bepaalt hoe lang je WW zou krijgen in de stresstest." nullable min={0} max={60} unit="jaar" />
          </div>
          <CheckboxField control={form.control} name={`applicants.${i}.previousHomeOwner`} label="Ik heb eerder een eigen woning gehad" help="Relevant voor de eigenwoningreserve en de bijleenregeling." />
          <CheckboxField control={form.control} name={`applicants.${i}.usedStartersExemption`} label="Ik heb de startersvrijstelling overdrachtsbelasting al eens gebruikt" help="Die mag je maar één keer gebruiken." />
        </FieldGroup>
      ))}
      <FieldGroup title="Huishouden">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            control={form.control}
            name="maritalStatus"
            label="Burgerlijke staat"
            help="Van belang voor de AOW-hoogte en bij scheiding of overlijden."
            options={[
              { value: "single", label: "Alleenstaand" },
              { value: "cohabiting", label: "Samenwonend" },
              { value: "married", label: "Getrouwd" },
              { value: "registered_partnership", label: "Geregistreerd partnerschap" },
            ]}
          />
          <SelectField
            control={form.control}
            name="prenup"
            label="Huwelijkse voorwaarden"
            help="Bepaalt of zakelijke schulden ook je partner raken."
            options={[
              { value: "none", label: "Geen / gemeenschap van goederen" },
              { value: "limited_community", label: "Beperkte gemeenschap (sinds 2018)" },
              { value: "prenuptial", label: "Huwelijkse voorwaarden" },
            ]}
          />
          <NumberField control={form.control} name="children" label="Aantal kinderen" help="Voor de begroting (kosten per kind)." min={0} max={15} />
          <NumberField control={form.control} name="childrenUnder18" label="Waarvan jonger dan 18" help="Bepaalt het recht op een ANW-uitkering bij overlijden." min={0} max={15} />
        </div>
      </FieldGroup>
    </WizardShell>
  )
}
