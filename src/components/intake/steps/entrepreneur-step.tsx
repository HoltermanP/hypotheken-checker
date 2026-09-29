"use client"

import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, useWatch, type Control } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { CheckboxField, FieldGroup, MoneyField, NumberField, SelectField, TextField } from "@/components/forms/fields"
import { defaultBusiness, emptyBvYear, lastYears, newId } from "@/lib/intake/defaults"
import { entrepreneurStep, SECTORS, type EntrepreneurStep } from "@/lib/intake/schema"
import { WizardShell } from "../wizard-shell"
import { useStepForm } from "../use-step-form"
import type { StepProps } from "./types"

type C = Control<EntrepreneurStep>

const SECTOR_LABELS: Record<(typeof SECTORS)[number], string> = {
  zakelijke_dienstverlening: "Zakelijke dienstverlening",
  ict: "ICT",
  zorg: "Zorg",
  bouw: "Bouw",
  horeca: "Horeca",
  detailhandel: "Detailhandel",
  groothandel: "Groothandel",
  transport: "Transport en logistiek",
  industrie: "Industrie",
  agrarisch: "Agrarisch",
  creatief: "Creatieve sector",
  overig: "Overig",
}

function SolePropYears({ control, p }: { control: C; p: string }) {
  const { fields } = useFieldArray({ control, name: `${p}.soleProp.years` as never })
  return (
    <div className="space-y-3">
      {fields.map((f, y) => {
        const yp = `${p}.soleProp.years.${y}`
        return (
          <FieldGroup key={f.id} title={`Jaar ${(f as unknown as { year: number }).year}`}>
            <div className="grid gap-4 sm:grid-cols-3">
              <MoneyField control={control} name={`${yp}.revenue` as never} label="Omzet" />
              <MoneyField control={control} name={`${yp}.profit` as never} allowNegative label="Winst vóór ondernemersaftrek" help="Bij vof/maatschap: jouw winstaandeel. Staat in je IB-aangifte." />
              <MoneyField control={control} name={`${yp}.depreciation` as never} label="Afschrijvingen" />
              <MoneyField control={control} name={`${yp}.investments` as never} label="Investeringen" />
              <MoneyField control={control} name={`${yp}.privateWithdrawals` as never} label="Privé-onttrekkingen" />
              <MoneyField control={control} name={`${yp}.incidentalGains` as never} label="Incidentele baten" help="Eenmalige opbrengsten; halen we uit de winst." />
              <MoneyField control={control} name={`${yp}.incidentalLosses` as never} label="Incidentele lasten" help="Eenmalige kosten; tellen we terug." />
              <MoneyField control={control} name={`${yp}.forDecrease` as never} label="Afname FOR" help="Een afname van de fiscale oudedagsreserve telt als inkomen." />
            </div>
            <CheckboxField control={control} name={`${yp}.hoursCriterionMet` as never} label="Urencriterium (1.225 uur) gehaald" help="Nodig voor zelfstandigen- en startersaftrek." />
          </FieldGroup>
        )
      })}
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField control={control} name={`${p}.soleProp.forBalance` as never} label="Stand fiscale oudedagsreserve (FOR)" help="De FOR is per 2023 afgeschaft; een bestaande reserve blijft staan." />
        <MoneyField control={control} name={`${p}.soleProp.forecastProfit` as never} nullable allowNegative label="Prognose winst lopend jaar" help="Voor startende ondernemers accepteren sommige banken een prognose." />
      </div>
    </div>
  )
}

function EntityFinancials({ control, ep }: { control: C; ep: string }) {
  const { fields } = useFieldArray({ control, name: `${ep}.financials` as never })
  return (
    <div className="space-y-3">
      {fields.map((f, y) => {
        const yp = `${ep}.financials.${y}`
        return (
          <details key={f.id} className="rounded-lg border p-3" open={y === fields.length - 1}>
            <summary className="cursor-pointer text-sm font-medium">Jaarcijfers {(f as unknown as { year: number }).year}</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <MoneyField control={control} name={`${yp}.revenue` as never} label="Omzet" />
              <MoneyField control={control} name={`${yp}.resultBeforeTax` as never} allowNegative label="Resultaat vóór belasting" />
              <MoneyField control={control} name={`${yp}.corporateTax` as never} label="Vennootschapsbelasting" />
              <MoneyField control={control} name={`${yp}.resultAfterTax` as never} allowNegative label="Resultaat na belasting" />
              <MoneyField control={control} name={`${yp}.dividendPaid` as never} label="Uitgekeerd dividend" />
              <MoneyField control={control} name={`${yp}.retainedEarnings` as never} allowNegative label="Winstreserves" />
              <MoneyField control={control} name={`${yp}.equity` as never} allowNegative label="Eigen vermogen" />
              <MoneyField control={control} name={`${yp}.balanceTotal` as never} label="Balanstotaal" />
              <MoneyField control={control} name={`${yp}.liquidAssets` as never} label="Liquide middelen" />
              <MoneyField control={control} name={`${yp}.currentAssets` as never} label="Vlottende activa (incl. liquide)" />
              <MoneyField control={control} name={`${yp}.currentLiabilities` as never} label="Kortlopende schulden" />
              <MoneyField control={control} name={`${yp}.longTermLiabilities` as never} label="Langlopende schulden" />
              <MoneyField control={control} name={`${yp}.dgaSalaryPaid` as never} label="DGA-salaris betaald door deze BV" />
              <MoneyField control={control} name={`${yp}.managementFeeReceived` as never} label="Ontvangen management fee" />
              <MoneyField control={control} name={`${yp}.managementFeePaid` as never} label="Betaalde management fee" />
              <MoneyField control={control} name={`${yp}.resultFromParticipations` as never} allowNegative label="Resultaat deelnemingen" help="Alleen holding; wordt bij consolidatie geëlimineerd." />
              <MoneyField control={control} name={`${yp}.participationsValue` as never} label="Boekwaarde deelnemingen" help="Alleen holding." />
              <MoneyField control={control} name={`${yp}.intercompanyReceivables` as never} label="Vorderingen op groepsmaatschappijen" />
              <MoneyField control={control} name={`${yp}.intercompanyPayables` as never} label="Schulden aan groepsmaatschappijen" />
            </div>
          </details>
        )
      })}
    </div>
  )
}

function BvSection({ control, p, calcYear }: { control: C; p: string; calcYear: number }) {
  const legalForm = useWatch({ control, name: `${p}.legalForm` as never }) as unknown as string
  const entities = useFieldArray({ control, name: `${p}.bv.entities` as never })
  const loans = useFieldArray({ control, name: `${p}.bv.loansToDga` as never })
  const salaries = useFieldArray({ control, name: `${p}.bv.salaries` as never })
  const entityList = (useWatch({ control, name: `${p}.bv.entities` as never }) ?? []) as { key: string; name: string }[]
  const holding = legalForm === "bv_holding"
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField control={control} name={`${p}.bv.shareholdingPct` as never} label="Jouw aandelenbelang" unit="%" help="Direct of via je holding. Bepaalt of je als DGA wordt gezien." />
        <MoneyField control={control} name={`${p}.bv.issuedCapital` as never} label="Geplaatst kapitaal" help="Mag niet worden uitgekeerd." />
        <MoneyField control={control} name={`${p}.bv.currentAccountDga` as never} allowNegative label="Rekening-courant DGA ↔ BV" help="Positief = jij bent de BV geld schuldig (telt mee voor excessief lenen)." />
        <MoneyField control={control} name={`${p}.bv.carBenefit` as never} label="Bijtelling auto per jaar" />
        <MoneyField control={control} name={`${p}.bv.pensionAccrual` as never} label="Pensioenopbouw per jaar" />
      </div>
      <CheckboxField control={control} name={`${p}.bv.statutoryDirector` as never} label="Ik ben statutair bestuurder" />
      <FieldGroup title="DGA-salaris per jaar" description="Staat op je jaaropgave. We toetsen aan de gebruikelijkloonregeling.">
        <div className="grid gap-4 sm:grid-cols-3">
          {salaries.fields.map((f, i) => (
            <MoneyField key={f.id} control={control} name={`${p}.bv.salaries.${i}.amount` as never} label={`Salaris ${(f as unknown as { year: number }).year}`} />
          ))}
        </div>
      </FieldGroup>
      {holding ? (
        <FieldGroup title="Holdingstructuur" description="Management fee van werkmaatschappij aan holding telt alleen mee als die zakelijk, structureel en contractueel is vastgelegd.">
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField control={control} name={`${p}.bv.managementFee.annual` as never} label="Management fee per jaar" />
            <CheckboxField control={control} name={`${p}.bv.fiscalUnity` as never} label="Fiscale eenheid Vpb" />
          </div>
          <CheckboxField control={control} name={`${p}.bv.managementFee.contractual` as never} label="Vastgelegd in een managementovereenkomst" />
          <CheckboxField control={control} name={`${p}.bv.managementFee.structural` as never} label="Structureel (elk jaar)" />
          <CheckboxField control={control} name={`${p}.bv.managementFee.armsLength` as never} label="Zakelijk (marktconforme hoogte)" />
        </FieldGroup>
      ) : null}
      {entities.fields.map((f, i) => {
        const ep = `${p}.bv.entities.${i}`
        return (
          <FieldGroup key={f.id} title={`Entiteit ${i + 1}`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={control} name={`${ep}.name` as never} label="Naam" />
              <SelectField control={control} name={`${ep}.role` as never} label="Rol" options={[{ value: "werkmaatschappij", label: "Werkmaatschappij" }, { value: "holding", label: "Holding" }]} />
              <SelectField
                control={control}
                name={`${ep}.parentKey` as never}
                label="Aandeelhouder"
                help="Wie houdt de aandelen van deze entiteit?"
                options={[{ value: "", label: "Ik (direct)" }, ...entityList.filter((_, j) => j !== i).map((e) => ({ value: e.key, label: e.name || "Entiteit" }))]}
              />
              <NumberField control={control} name={`${ep}.ownershipPct` as never} label="Belang" unit="%" />
            </div>
            <EntityFinancials control={control} ep={ep} />
            {entities.fields.length > 1 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => entities.remove(i)}>
                <Trash2 aria-hidden /> Entiteit verwijderen
              </Button>
            ) : null}
          </FieldGroup>
        )
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          entities.append({ key: newId(), name: holding ? "Holding" : "BV", role: holding ? "holding" : "werkmaatschappij", parentKey: null, ownershipPct: 100, financials: lastYears(calcYear).map(emptyBvYear) } as never)
        }
      >
        <Plus aria-hidden /> Entiteit toevoegen
      </Button>
      <FieldGroup title="Leningen van je BV aan jou" description="Voor de Wet excessief lenen (drempel € 500.000).">
        {loans.fields.map((f, i) => (
          <div key={f.id} className="grid gap-4 rounded-lg border p-3 sm:grid-cols-3">
            <MoneyField control={control} name={`${p}.bv.loansToDga.${i}.amount` as never} label="Bedrag" />
            <SelectField control={control} name={`${p}.bv.loansToDga.${i}.purpose` as never} label="Doel" options={[{ value: "eigen_woning", label: "Eigen woning" }, { value: "consumptief", label: "Consumptief" }, { value: "overig", label: "Overig" }]} />
            <NumberField control={control} name={`${p}.bv.loansToDga.${i}.ratePct` as never} label="Rente" step={0.01} unit="%" />
            <CheckboxField control={control} name={`${p}.bv.loansToDga.${i}.mortgageRight` as never} label="Hypotheekrecht gevestigd voor de BV" />
            <CheckboxField control={control} name={`${p}.bv.loansToDga.${i}.existedBefore2023` as never} label="Bestond al vóór 2023" />
            <Button type="button" size="sm" variant="ghost" onClick={() => loans.remove(i)}>
              <Trash2 aria-hidden /> Verwijderen
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => loans.append({ id: newId(), amount: 0, purpose: "overig", mortgageRight: false, existedBefore2023: false, ratePct: 0 } as never)}>
          <Plus aria-hidden /> Lening toevoegen
        </Button>
      </FieldGroup>
    </div>
  )
}

function BusinessFields({ control, p, calcYear }: { control: C; p: string; calcYear: number }) {
  const legalForm = useWatch({ control, name: `${p}.legalForm` as never }) as unknown as string
  const aov = useWatch({ control, name: `${p}.aovHas` as never }) as unknown as boolean
  const guarantees = useFieldArray({ control, name: `${p}.guarantees` as never })
  const isBv = legalForm === "bv" || legalForm === "bv_holding"
  const partnership = legalForm === "vof" || legalForm === "maatschap" || legalForm === "cv"
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField control={control} name={`${p}.name` as never} label="Naam onderneming" />
        <TextField control={control} name={`${p}.kvkNumber` as never} label="KvK-nummer" help="8 cijfers; staat op je KvK-uittreksel." />
        <SelectField
          control={control}
          name={`${p}.legalForm` as never}
          label="Rechtsvorm"
          help="Bepaalt hoe banken je inkomen berekenen."
          options={[
            { value: "eenmanszaak", label: "Eenmanszaak" },
            { value: "vof", label: "Vof" },
            { value: "maatschap", label: "Maatschap" },
            { value: "cv", label: "Cv" },
            { value: "bv", label: "BV (DGA)" },
            { value: "bv_holding", label: "BV met holding" },
          ]}
        />
        <TextField control={control} name={`${p}.startDate` as never} type="date" label="Startdatum onderneming" help="Starters (< 3 jaar) worden anders beoordeeld." />
        <SelectField control={control} name={`${p}.sector` as never} label="Branche" options={SECTORS.map((s) => ({ value: s, label: SECTOR_LABELS[s] }))} />
        {partnership ? <NumberField control={control} name={`${p}.profitSharePct` as never} label="Jouw winstaandeel" unit="%" /> : null}
        <NumberField control={control} name={`${p}.largestClientPct` as never} label="Omzetaandeel grootste opdrachtgever" unit="%" help="Afhankelijkheid van één klant verhoogt het risico." />
        <NumberField control={control} name={`${p}.orderBookMonths` as never} nullable label="Orderportefeuille" unit="maanden" help="Hoeveel maanden werk heb je al vastliggen?" />
        <MoneyField control={control} name={`${p}.ivoIncome` as never} nullable label="Toetsinkomen volgens IVO (optioneel)" help="Heb je een Inkomensverklaring Ondernemer? Vul het toetsinkomen in." />
      </div>
      {isBv ? <BvSection control={control} p={p} calcYear={calcYear} /> : <SolePropYears control={control} p={p} />}
      <FieldGroup title="Vooruitzichten en timing">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField control={control} name={`${p}.nextFiguresDate` as never} type="date" label="Wanneer is de volgende jaarrekening klaar?" help="Soms loont het om op betere cijfers te wachten." />
          <MoneyField control={control} name={`${p}.expectedCurrentYearProfit` as never} nullable allowNegative label={isBv ? "Verwacht resultaat na belasting dit jaar" : "Verwachte winst dit jaar"} />
          <TextField control={control} name={`${p}.fluctuationExplanation` as never} label="Toelichting bij grote verschillen tussen jaren" help="Bijvoorbeeld een eenmalige opdracht of investering." className="sm:col-span-2" />
        </div>
      </FieldGroup>
      <FieldGroup title="Risico's en verplichtingen">
        <div className="grid gap-4 sm:grid-cols-2">
          <CheckboxField control={control} name={`${p}.aovHas` as never} label="Ik heb een arbeidsongeschiktheidsverzekering (AOV)" help="Ondernemers hebben geen WW en meestal geen WIA." />
          {aov ? <MoneyField control={control} name={`${p}.aovMonthlyBenefit` as never} label="Verzekerd bedrag per maand" /> : null}
          <CheckboxField control={control} name={`${p}.broodfonds` as never} label="Ik ben lid van een broodfonds" />
          <MoneyField control={control} name={`${p}.annuityPremiumAnnual` as never} label="Lijfrente-inleg per jaar" help="Beïnvloedt je besteedbaar inkomen en pensioen." />
          <MoneyField control={control} name={`${p}.businessDebts` as never} label="Zakelijke schulden" />
        </div>
        {guarantees.fields.map((f, i) => (
          <div key={f.id} className="grid gap-4 rounded-lg border p-3 sm:grid-cols-3">
            <MoneyField control={control} name={`${p}.guarantees.${i}.amount` as never} label="Borgstelling" />
            <TextField control={control} name={`${p}.guarantees.${i}.description` as never} label="Voor welk krediet" />
            <CheckboxField control={control} name={`${p}.guarantees.${i}.jointAndSeveral` as never} label="Hoofdelijk aansprakelijk" />
            <Button type="button" size="sm" variant="ghost" onClick={() => guarantees.remove(i)}>
              <Trash2 aria-hidden /> Verwijderen
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => guarantees.append({ amount: 0, description: "", jointAndSeveral: false } as never)}>
          <Plus aria-hidden /> Privé-borgstelling toevoegen
        </Button>
      </FieldGroup>
    </div>
  )
}

function ApplicantBusinesses({ control, a, title, calcYear }: { control: C; a: number; title: string; calcYear: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: `applicants.${a}.businesses` })
  return (
    <FieldGroup title={title}>
      {fields.map((f, b) => (
        <div key={f.id} className="space-y-3 rounded-xl border p-4">
          <BusinessFields control={control} p={`applicants.${a}.businesses.${b}`} calcYear={calcYear} />
          <Button type="button" size="sm" variant="ghost" onClick={() => remove(b)}>
            <Trash2 aria-hidden /> Onderneming verwijderen
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => append(defaultBusiness(calcYear))}>
        <Plus aria-hidden /> Onderneming toevoegen
      </Button>
    </FieldGroup>
  )
}

export function EntrepreneurStepForm({ dossierId, defaults, prev, context }: StepProps<EntrepreneurStep>) {
  const { form, submit, status, serverErrors } = useStepForm(entrepreneurStep, defaults, { dossierId, step: "ondernemer" })
  return (
    <WizardShell dossierId={dossierId} step="ondernemer" prev={prev} status={status} serverErrors={serverErrors} onSubmit={submit} submitting={form.formState.isSubmitting}>
      <p className="text-sm text-muted-foreground">
        Banken rekenen je inkomen verschillend uit. Vul de cijfers van de laatste drie jaar in (uit je IB-aangifte of jaarrekening); we laten per bank zien welk toetsinkomen eruit komt.
      </p>
      {defaults.applicants.map((_, a) =>
        context.entrepreneurs[a] ? (
          <ApplicantBusinesses key={a} control={form.control} a={a} calcYear={context.calcYear} title={context.names[a] ?? (a === 0 ? "Jouw onderneming" : "Onderneming partner")} />
        ) : null
      )}
    </WizardShell>
  )
}
