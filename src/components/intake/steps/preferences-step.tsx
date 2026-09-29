"use client"

import { Controller, useWatch } from "react-hook-form"
import { CheckboxField, FieldGroup, MoneyField, NumberField, SelectField } from "@/components/forms/fields"
import { preferencesStep, type PreferencesStep } from "@/lib/intake/schema"
import { WizardShell } from "../wizard-shell"
import { useStepForm } from "../use-step-form"
import type { StepProps } from "./types"

const GOAL_LABELS: Record<string, string> = {
  pensioen: "Goed voorbereid op mijn pensioen",
  kinderen: "Ruimte voor (meer) kinderen",
  minder_werken: "Later minder werken",
  eerder_stoppen: "Eerder stoppen met werken",
  verduurzamen: "Mijn woning verduurzamen",
  vermogen_opbouwen: "Vermogen opbouwen",
}

export function PreferencesStepForm({ dossierId, defaults, prev, context }: StepProps<PreferencesStep>) {
  const { form, submit, status, serverErrors } = useStepForm(preferencesStep, defaults, { dossierId, step: "voorkeuren" })
  const c = form.control
  const repayment = useWatch({ control: c, name: "repaymentType" })
  return (
    <WizardShell dossierId={dossierId} step="voorkeuren" prev={prev} status={status} serverErrors={serverErrors} onSubmit={submit} submitting={form.formState.isSubmitting}>
      <FieldGroup title="Hypotheekvorm">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            control={c}
            name="fixedRateYears"
            numeric
            label="Rentevaste periode"
            help="Korter dan 10 jaar: je wordt getoetst op 5% (AFM-toetsrente)."
            options={[1, 2, 3, 5, 6, 7, 10, 12, 15, 20, 25, 30].map((v) => ({ value: v, label: `${v} jaar` }))}
          />
          <SelectField
            control={c}
            name="repaymentType"
            label="Aflossingsvorm"
            help="Alleen annuïtair of lineair aflossen geeft renteaftrek."
            options={[
              { value: "annuity", label: "Annuïtair (gelijke bruto maandlast)" },
              { value: "linear", label: "Lineair (dalende maandlast)" },
              { value: "mixed", label: "Deels aflossingsvrij" },
            ]}
          />
          {repayment === "mixed" ? (
            <NumberField control={c} name="interestOnlyPct" label="Aflossingsvrij deel" help="Maximaal 50% (bij veel banken nu 30%); niet aftrekbaar en niet met NHG." unit="% van de lening" min={0} max={50} />
          ) : null}
          <SelectField
            control={c}
            name="nhg"
            label="Nationale Hypotheek Garantie"
            help="NHG geeft een lagere rente en vangnet bij restschuld; kan tot de kostengrens."
            options={[
              { value: "unknown", label: "Weet ik niet (als het kan)" },
              { value: "yes", label: "Ja" },
              { value: "no", label: "Nee" },
            ]}
          />
          <SelectField
            control={c}
            name="riskAppetite"
            label="Hoeveel risico wil je lopen?"
            help="Stuurt het advies over rentevast, aflossen en buffers."
            options={[
              { value: "low", label: "Weinig: zekerheid gaat voor" },
              { value: "medium", label: "Gemiddeld" },
              { value: "high", label: "Veel: ik accepteer schommelingen" },
            ]}
          />
          <MoneyField control={c} name="maxNetMonthly" nullable label="Maximale netto maandlast (optioneel)" help="Het verstandige leenbedrag blijft daaronder." />
        </div>
      </FieldGroup>
      {context.goal === "verhogen" ? (
        <FieldGroup title="Verhogen of overwaarde opnemen">
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField control={c} name="equityReleaseAmount" label="Gewenst extra bedrag" help="Hoeveel wil je extra lenen?" />
            <SelectField
              control={c}
              name="equityReleasePurpose"
              label="Waarvoor?"
              help="Alleen voor de woning (verbouwen, verduurzamen) is de rente aftrekbaar."
              options={[
                { value: "renovation", label: "Verbouwing" },
                { value: "energy", label: "Verduurzaming" },
                { value: "consumption", label: "Consumptief (auto, reis, …)" },
                { value: "business", label: "Investering in mijn onderneming" },
                { value: "gift_children", label: "Schenken aan kinderen" },
                { value: "pension", label: "Aanvulling op pensioen" },
              ]}
            />
          </div>
        </FieldGroup>
      ) : null}
      <FieldGroup title="Wat vind je belangrijk?" description="We nemen dit mee in de toelichting en de scenario's.">
        <Controller
          control={c}
          name="goals"
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(GOAL_LABELS).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={(field.value ?? []).includes(k as never)}
                    onChange={(e) => field.onChange(e.target.checked ? [...(field.value ?? []), k] : (field.value ?? []).filter((x: string) => x !== k))}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        />
      </FieldGroup>
      {context.isDga ? (
        <CheckboxField control={c} name="showHomeInBv" label="Toon ook de berekening van een woning in mijn BV" help="Meestal ongunstig; we laten zien waarom." />
      ) : null}
    </WizardShell>
  )
}
