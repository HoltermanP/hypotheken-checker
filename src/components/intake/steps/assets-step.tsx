"use client"

import { FieldGroup, MoneyField, NumberField } from "@/components/forms/fields"
import { assetsStep, type AssetsStep } from "@/lib/intake/schema"
import { WizardShell } from "../wizard-shell"
import { useStepForm } from "../use-step-form"
import type { StepProps } from "./types"

export function AssetsStepForm({ dossierId, defaults, prev }: StepProps<AssetsStep>) {
  const { form, submit, status, serverErrors } = useStepForm(assetsStep, defaults, { dossierId, step: "vermogen" })
  const c = form.control
  return (
    <WizardShell dossierId={dossierId} step="vermogen" prev={prev} status={status} serverErrors={serverErrors} onSubmit={submit} submitting={form.formState.isSubmitting}>
      <FieldGroup title="Eigen geld" description="Kosten koper betaal je uit eigen geld. We kijken ook of inbrengen of aanhouden voordeliger is.">
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField control={c} name="savings" label="Spaargeld" help="Op betaal- en spaarrekeningen." />
          <MoneyField control={c} name="investments" label="Beleggingen" help="Waarde van je beleggingen." />
          <MoneyField control={c} name="desiredBuffer" label="Buffer die je wilt aanhouden" help="Geld dat je achter de hand houdt voor onverwachte uitgaven (Nibud adviseert een buffer)." />
          <MoneyField control={c} name="ownFundsToContribute" nullable label="Bedrag dat je wilt inbrengen (optioneel)" help="Laat leeg om alles boven je buffer in te brengen." />
        </div>
      </FieldGroup>
      <FieldGroup title="Hulp van ouders of familie" description="Een schenking verlaagt je hypotheek. Let op: de extra vrijstelling voor de eigen woning (jubelton) bestaat sinds 2024 niet meer.">
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField control={c} name="giftAmount" label="Schenking" help="Bedrag dat je krijgt (boven de jaarlijkse vrijstelling betaal je schenkbelasting)." />
          <MoneyField control={c} name="familyLoanAmount" label="Lening van familie (familiebank)" help="Een lening met zakelijke rente kan fiscaal aftrekbaar zijn." />
          <NumberField control={c} name="familyLoanRatePct" label="Rente familielening" help="Zakelijke rente, vergelijkbaar met een bank." step={0.01} unit="%" />
        </div>
      </FieldGroup>
      <FieldGroup title="Eigenwoningreserve">
        <MoneyField control={c} name="eigenwoningreserve" label="Eigenwoningreserve uit een eerdere verkoop" help="Overwaarde van een eerdere woning (binnen 3 jaar) die je volgens de bijleenregeling moet inbrengen. Weet je het niet, vul 0 in." />
      </FieldGroup>
    </WizardShell>
  )
}
