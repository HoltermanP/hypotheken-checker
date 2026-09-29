"use client"

import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, useWatch, type Control } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { CheckboxField, FieldGroup, MoneyField, SelectField, TextField } from "@/components/forms/fields"
import { incomeStep, type IncomeStep } from "@/lib/intake/schema"
import { defaultEmployment, newId } from "@/lib/intake/defaults"
import { WizardShell } from "../wizard-shell"
import { useStepForm } from "../use-step-form"
import type { StepProps } from "./types"

const KIND_LABEL: Record<string, string> = {
  employment: "Loondienst",
  benefit: "Uitkering",
  pension: "Pensioen of AOW",
  rental: "Huurinkomsten",
  alimony_received: "Ontvangen partneralimentatie",
}

function IncomeItemFields({ control, a, j }: { control: Control<IncomeStep>; a: number; j: number }) {
  const kind = useWatch({ control, name: `applicants.${a}.incomes.${j}.kind` })
  const contract = useWatch({ control, name: `applicants.${a}.incomes.${j}.contract` as never }) as string | undefined
  const p = `applicants.${a}.incomes.${j}` as const
  if (kind === "employment") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name={`${p}.employer` as never} label="Werkgever (optioneel)" help="Om documenten te koppelen." />
        <SelectField
          control={control}
          name={`${p}.contract` as never}
          label="Soort contract"
          help="Bepaalt hoe je inkomen meetelt."
          options={[
            { value: "permanent", label: "Vast contract" },
            { value: "temporary_with_intent", label: "Tijdelijk met intentieverklaring" },
            { value: "perspectiefverklaring", label: "Tijdelijk met perspectiefverklaring" },
            { value: "temporary", label: "Tijdelijk zonder intentieverklaring" },
            { value: "flex", label: "Flexibel / oproep / uitzend" },
          ]}
        />
        <MoneyField control={control} name={`${p}.grossAnnualSalary` as never} label="Bruto jaarsalaris (zonder vakantiegeld)" help="Staat op je werkgeversverklaring of salarisstrook × 12." />
        <MoneyField control={control} name={`${p}.holidayPay` as never} label="Vakantiegeld per jaar" help="Meestal 8% van het salaris." />
        <MoneyField control={control} name={`${p}.thirteenthMonth` as never} label="Vaste 13e maand" help="Alleen als die vast (onvoorwaardelijk) is." />
        <MoneyField control={control} name={`${p}.fixedYearEndBonus` as never} label="Vaste eindejaarsuitkering" help="Alleen vaste, niet-variabele uitkeringen." />
        <MoneyField control={control} name={`${p}.irregularityAllowance` as never} label="Onregelmatigheidstoeslag (structureel)" help="Telt mee als die structureel is." />
        <MoneyField control={control} name={`${p}.commission` as never} label="Provisie (structureel, gemiddeld)" help="Gemiddelde van de afgelopen jaren." />
        {contract === "temporary" || contract === "flex" ? (
          <MoneyField control={control} name={`${p}.iblToetsinkomen` as never} nullable label="IBL-toetsinkomen" help="Zonder vast contract telt je inkomen via de Inkomensbepaling Loondienst (UWV-gegevens). Vraag dit aan via je adviseur of de IBL-tool." />
        ) : null}
      </div>
    )
  }
  if (kind === "benefit") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name={`${p}.benefitType` as never}
          label="Soort uitkering"
          help="Alleen duurzame uitkeringen tellen mee."
          options={[
            { value: "wia_iva", label: "WIA – IVA" },
            { value: "wia_wga", label: "WIA – WGA" },
            { value: "wajong", label: "Wajong" },
            { value: "ww", label: "WW" },
            { value: "other", label: "Anders" },
          ]}
        />
        <MoneyField control={control} name={`${p}.grossAnnual` as never} label="Bruto per jaar" help="Inclusief vakantiegeld." />
        <CheckboxField control={control} name={`${p}.permanent` as never} label="Deze uitkering is duurzaam (geen einddatum)" />
      </div>
    )
  }
  if (kind === "pension") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={control} name={`${p}.pensionType` as never} label="Soort" options={[{ value: "aow", label: "AOW" }, { value: "pension", label: "Pensioen" }, { value: "lijfrente", label: "Lijfrente-uitkering" }]} />
        <MoneyField control={control} name={`${p}.grossAnnual` as never} label="Bruto per jaar" help="Staat op mijnpensioenoverzicht.nl." />
      </div>
    )
  }
  return <MoneyField control={control} name={`${p}.grossAnnual` as never} label="Bruto per jaar" help={kind === "rental" ? "Huurinkomsten tellen in de standaardtoets niet mee, maar wel in je begroting." : "Telt mee zolang je er recht op hebt."} />
}

function ApplicantIncome({ control, a, title }: { control: Control<IncomeStep>; a: number; title: string }) {
  const { fields, append, remove } = useFieldArray({ control, name: `applicants.${a}.incomes` })
  return (
    <FieldGroup title={title}>
      {fields.map((f, j) => (
        <div key={f.id} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{KIND_LABEL[(f as unknown as { kind: string }).kind]}</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(j)} aria-label="Inkomen verwijderen">
              <Trash2 aria-hidden />
            </Button>
          </div>
          <IncomeItemFields control={control} a={a} j={j} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => append(defaultEmployment())}><Plus aria-hidden /> Loondienst</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => append({ id: newId(), kind: "benefit", benefitType: "wia_iva", grossAnnual: 0, permanent: true })}><Plus aria-hidden /> Uitkering</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => append({ id: newId(), kind: "pension", pensionType: "pension", grossAnnual: 0 })}><Plus aria-hidden /> Pensioen</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => append({ id: newId(), kind: "rental", grossAnnual: 0 })}><Plus aria-hidden /> Huur</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => append({ id: newId(), kind: "alimony_received", grossAnnual: 0 })}><Plus aria-hidden /> Alimentatie</Button>
      </div>
      <CheckboxField control={control} name={`applicants.${a}.isEntrepreneur`} label="Ik ben (ook) ondernemer (eenmanszaak, vof, BV of holding)" help="Dan vragen we in de volgende stap naar de cijfers van je onderneming." />
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField control={control} name={`applicants.${a}.expectedRetirementIncome`} nullable label="Verwacht inkomen na pensionering (AOW + pensioen)" help="Voor de AOW-toets. Kijk op mijnpensioenoverzicht.nl. Leeg = we rekenen met alleen de AOW." />
        <MoneyField control={control} name={`applicants.${a}.alimonyPaidAnnual`} label="Betaalde partneralimentatie per jaar" help="Wordt van je toetsinkomen afgetrokken." />
      </div>
    </FieldGroup>
  )
}

export function IncomeStepForm({ dossierId, defaults, prev, context }: StepProps<IncomeStep>) {
  const { form, submit, status, serverErrors } = useStepForm(incomeStep, defaults, { dossierId, step: "inkomen" })
  return (
    <WizardShell dossierId={dossierId} step="inkomen" prev={prev} status={status} serverErrors={serverErrors} onSubmit={submit} submitting={form.formState.isSubmitting}>
      {defaults.applicants.map((_, a) => (
        <ApplicantIncome key={a} control={form.control} a={a} title={context.names[a] ?? (a === 0 ? "Jouw inkomen" : "Inkomen partner")} />
      ))}
    </WizardShell>
  )
}
