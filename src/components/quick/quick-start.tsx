"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Calculator, CheckCircle2, FileUp, Loader2, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react"
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormSetValue } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CheckboxField, FieldGroup, MoneyField, NumberField, SelectField, TextField } from "@/components/forms/fields"
import { uploadDocumentFile } from "@/components/documents/upload-file"
import { deleteDocumentAction } from "@/app/app/dossiers/[id]/documenten/actions"
import { quickCalculateAction, quickExtractAction, saveQuickDraftAction } from "@/app/app/dossiers/[id]/start/actions"
import type { WorkbenchLender } from "@/components/entrepreneur/financials-workbench"
import { ACCEPT_ATTR } from "@/lib/documents/types"
import { businessIncome, withDefaults } from "@/lib/engine/entrepreneur"
import type { LenderEntrepreneurPolicy } from "@/lib/engine/lenders/types"
import type { NormValues } from "@/lib/engine/norms"
import { formatEuro } from "@/lib/format"
import { GOAL_OPTIONS } from "@/lib/intake/goals"
import { ENERGY_LABELS } from "@/lib/intake/schema"
import { businessToEngine } from "@/lib/intake/to-engine"
import { CURRENT_HOME_GOALS, emptyLoanPart, emptyQuickApplicant, quickBusiness, quickForm, TARGET_HOME_GOALS, type QuickForm } from "@/lib/quick/quick"
import type { QuickDocView, QuickFinancialsView } from "@/lib/services/quick"
import { cn } from "@/lib/utils"

const CONTRACT_OPTIONS = [
  { value: "permanent", label: "Vast contract" },
  { value: "temporary_with_intent", label: "Tijdelijk, met intentieverklaring" },
  { value: "temporary", label: "Tijdelijk" },
  { value: "flex", label: "Flex / oproep / uitzend" },
]
const LOAN_OPTIONS = [
  { value: "annuity", label: "Annuïteit" },
  { value: "linear", label: "Lineair" },
  { value: "interest_only", label: "Aflossingsvrij" },
  { value: "savings", label: "Spaarhypotheek" },
  { value: "investment", label: "Beleggingshypotheek" },
]
const FIXED_RATE_OPTIONS = [1, 2, 3, 5, 6, 7, 10, 12, 15, 20, 25, 30].map((y) => ({ value: y, label: `${y} jaar` }))
const LABEL_OPTIONS = ENERGY_LABELS.map((l) => ({ value: l, label: l === "geen" ? "Onbekend / geen" : l }))

type SaveStatus = "idle" | "saving" | "saved" | "error"

export function QuickStart({
  dossierId,
  defaults,
  docs,
  financials,
  calcYear,
  local,
  lenders,
  gebruikelijkLoon,
}: {
  dossierId: string
  defaults: QuickForm
  docs: QuickDocView[]
  financials: (QuickFinancialsView | null)[]
  calcYear: number
  local: boolean
  lenders: WorkbenchLender[]
  gebruikelijkLoon: number
}) {
  const form = useForm<QuickForm>({ resolver: zodResolver(quickForm), defaultValues: defaults, mode: "onBlur" })
  const { control, setValue, getValues } = form
  const goal = useWatch({ control, name: "goal" })
  const hasPartner = useWatch({ control, name: "hasPartner" })
  const applicants = useWatch({ control, name: "applicants" })
  const [status, setStatus] = useState<SaveStatus>("idle")
  const [errors, setErrors] = useState<string[]>([])
  const [pending, start] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Concept automatisch bewaren
  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(async () => {
          setStatus("saving")
          const r = await saveQuickDraftAction(dossierId, values)
          setStatus(r.ok ? "saved" : "error")
        }, 1500)
      },
    })
    return () => {
      unsubscribe()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [form, dossierId])

  const setPartner = (on: boolean) => {
    setValue("hasPartner", on)
    const list = getValues("applicants")
    setValue("applicants", on ? [list[0]!, list[1] ?? emptyQuickApplicant()] : [list[0]!], { shouldDirty: true })
  }

  const submit = form.handleSubmit(
    (values) =>
      start(async () => {
        setErrors([])
        const r = await quickCalculateAction(dossierId, values)
        if (r && !r.ok) setErrors(r.errors)
      }),
    () => setErrors(["Controleer de rood gemarkeerde velden."])
  )

  const needsCurrent = CURRENT_HOME_GOALS.includes(goal)
  const needsTarget = TARGET_HOME_GOALS.includes(goal)
  const names = applicants.map((a, i) => a.firstName || (i === 0 ? "Jij" : "Je partner"))

  return (
    <form noValidate onSubmit={submit} className="space-y-6">
      <section aria-labelledby="q-doel" className="space-y-3">
        <h2 id="q-doel" className="text-lg font-semibold">1. Wat wil je doen?</h2>
        <Controller
          control={control}
          name="goal"
          render={({ field }) => (
            <div role="radiogroup" aria-labelledby="q-doel" className="grid gap-2 sm:grid-cols-3">
              {GOAL_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                    field.value === o.value && "border-primary bg-primary/5 font-medium"
                  )}
                >
                  <input type="radio" name="goal" value={o.value} checked={field.value === o.value} onChange={() => field.onChange(o.value)} className="accent-[var(--primary)]" />
                  {o.label}
                </label>
              ))}
            </div>
          )}
        />
      </section>

      <section aria-labelledby="q-wie" className="space-y-3">
        <h2 id="q-wie" className="text-lg font-semibold">2. Wie vraagt de hypotheek aan?</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={hasPartner} onChange={(e) => setPartner(e.target.checked)} />
          Ik koop samen met een partner
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          {applicants.map((_, i) => (
            <ApplicantCard
              key={i}
              index={i}
              title={i === 0 ? "Aanvrager" : "Partner"}
              control={control}
              setValue={setValue}
              dossierId={dossierId}
              local={local}
              docs={docs.filter((d) => d.applicantPosition === i + 1)}
              financials={financials[i] ?? null}
              name={names[i]!}
              calcYear={calcYear}
              lenders={lenders}
              gebruikelijkLoon={gebruikelijkLoon}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="q-geld" className="space-y-3">
        <h2 id="q-geld" className="text-lg font-semibold">3. Geld, schulden en woning</h2>
        <FieldGroup title="Vermogen">
          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField control={control} name="savings" label="Spaargeld" help="Samen, op betaal- en spaarrekeningen." />
            <MoneyField control={control} name="investments" label="Beleggingen" />
            <MoneyField control={control} name="giftAmount" label="Schenking van ouders/familie" />
          </div>
        </FieldGroup>
        <FieldGroup title="Schulden" description="Laat op 0 staan als je ze niet hebt.">
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField control={control} name="studentLoanMonthly" label="Studieschuld: maandbedrag" help="Volgens Mijn DUO." />
            <MoneyField control={control} name="studentLoanOutstanding" label="Studieschuld: openstaand" />
            <MoneyField control={control} name="otherDebtMonthly" label="Andere leningen: maandbedrag" help="Persoonlijke lening, private lease, creditcard." />
            <MoneyField control={control} name="otherDebtOutstanding" label="Andere leningen: openstaand of limiet" />
          </div>
        </FieldGroup>
        {needsCurrent ? <CurrentHome control={control} calcYear={calcYear} /> : null}
        {needsTarget ? (
          <FieldGroup title="Nieuwe woning">
            <div className="grid gap-4 sm:grid-cols-3">
              <MoneyField control={control} name="targetHome.purchasePrice" label="Koopsom" />
              <SelectField control={control} name="targetHome.energyLabel" label="Energielabel" options={LABEL_OPTIONS} />
              <CheckboxField control={control} name="targetHome.newBuild" label="Nieuwbouw" className="self-end pb-1" />
            </div>
          </FieldGroup>
        ) : null}
        {goal === "verhogen" ? (
          <FieldGroup title="Verhogen">
            <MoneyField control={control} name="equityReleaseAmount" label="Hoeveel wil je extra lenen?" />
          </FieldGroup>
        ) : null}
        <FieldGroup title="Voorkeur">
          <div className="max-w-xs">
            <SelectField control={control} name="fixedRateYears" label="Rentevaste periode" options={FIXED_RATE_OPTIONS} numeric help="Weet je het niet? 10 jaar is gebruikelijk." />
          </div>
        </FieldGroup>
      </section>

      {errors.length > 0 ? (
        <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {errors.slice(0, 6).map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Calculator aria-hidden />}
          Bereken mijn advies
        </Button>
        <p aria-live="polite" className="ml-auto text-xs text-muted-foreground">
          {status === "saving" ? "Opslaan…" : status === "saved" ? "Automatisch opgeslagen" : status === "error" ? "Niet opgeslagen" : ""}
        </p>
      </div>
    </form>
  )
}

// ----------------------------------------------------------------------------- aanvrager

function ApplicantCard({
  index,
  title,
  name,
  control,
  setValue,
  dossierId,
  local,
  docs,
  financials,
  calcYear,
  lenders,
  gebruikelijkLoon,
}: {
  calcYear: number
  lenders: WorkbenchLender[]
  gebruikelijkLoon: number
  index: number
  title: string
  name: string
  control: Control<QuickForm>
  setValue: UseFormSetValue<QuickForm>
  dossierId: string
  local: boolean
  docs: QuickDocView[]
  financials: QuickFinancialsView | null
}) {
  const p = `applicants.${index}` as const
  const isBv = financials?.legalForm === "bv" || financials?.legalForm === "bv_holding"
  const salary = useWatch({ control, name: `${p}.grossMonthlySalary` })
  const fromBv = useWatch({ control, name: `${p}.salaryFromOwnBv` })

  const onExtracted = (r: Awaited<ReturnType<typeof quickExtractAction>>) => {
    if (!r.ok) return
    const s = r.data.salary
    const opts = { shouldDirty: true, shouldValidate: true }
    if (s?.grossMonthlySalary) setValue(`${p}.grossMonthlySalary`, s.grossMonthlySalary, opts)
    if (s?.holidayPayPct !== undefined) setValue(`${p}.holidayPayPct`, s.holidayPayPct, opts)
    if (s?.thirteenthMonth !== undefined) setValue(`${p}.thirteenthMonth`, s.thirteenthMonth, opts)
    if (s?.contract) setValue(`${p}.contract`, s.contract, opts)
    if (s?.dateOfBirth) setValue(`${p}.dateOfBirth`, s.dateOfBirth, opts)
    if (r.data.legalForm === "bv" || r.data.legalForm === "bv_holding") setValue(`${p}.salaryFromOwnBv`, true, opts)
  }

  return (
    <fieldset className="space-y-4 rounded-xl border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name={`${p}.firstName`} label="Voornaam (optioneel)" />
        <TextField control={control} name={`${p}.dateOfBirth`} label="Geboortedatum" type="date" />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Documenten van {name === "Jij" ? "jou" : name === "Je partner" ? "je partner" : name}</p>
        <div className="flex flex-wrap gap-2">
          <UploadDocs label="Loonstroken uploaden" type="salarisstrook" position={index + 1} dossierId={dossierId} local={local} onExtracted={onExtracted} />
          <UploadDocs label="Jaarcijfers uploaden" type="jaarcijfers_onderneming" position={index + 1} dossierId={dossierId} local={local} onExtracted={onExtracted} />
        </div>
        <p className="text-xs text-muted-foreground">
          Loonstrook of werkgeversverklaring (pdf of foto). Ondernemer? Upload de jaarrekeningen van de laatste 3 jaar (je kunt meerdere bestanden tegelijk kiezen) of één
          Excel-overzicht. We voegen de jaren samen en berekenen direct je toetsinkomen.
        </p>
        <DocList docs={docs} dossierId={dossierId} />
      </div>

      <div className="space-y-4 rounded-lg bg-muted/40 p-3">
        <p className="text-sm font-medium">Loondienst</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField control={control} name={`${p}.grossMonthlySalary`} label="Bruto maandsalaris" help="Zonder vakantiegeld. 0 als je niet in loondienst bent." />
          <NumberField control={control} name={`${p}.holidayPayPct`} label="Vakantiegeld" unit="%" step={0.1} />
          <SelectField control={control} name={`${p}.contract`} label="Contract" options={CONTRACT_OPTIONS} />
          <CheckboxField control={control} name={`${p}.thirteenthMonth`} label="Vaste 13e maand" className="self-end pb-1" />
        </div>
        {salary > 0 ? (
          <p className="text-xs text-muted-foreground">
            Bruto per jaar: {formatEuro(salary * 12)} + vakantiegeld{fromBv && isBv ? " — telt als DGA-salaris" : ""}.
          </p>
        ) : null}
        {isBv ? <CheckboxField control={control} name={`${p}.salaryFromOwnBv`} label="Dit salaris krijg ik van mijn eigen BV (DGA)" help="Dan tellen we het als DGA-salaris in de BV-toets en niet dubbel." /> : null}
      </div>

      {financials ? (
        <EntrepreneurIncome f={financials} dossierId={dossierId} control={control} index={index} calcYear={calcYear} lenders={lenders} gebruikelijkLoon={gebruikelijkLoon} />
      ) : null}
    </fieldset>
  )
}

function UploadDocs({
  label,
  type,
  position,
  dossierId,
  local,
  onExtracted,
}: {
  label: string
  type: string
  position: number
  dossierId: string
  local: boolean
  onExtracted: (r: Awaited<ReturnType<typeof quickExtractAction>>) => void
}) {
  const inputId = useId()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  async function onFiles(files: File[]) {
    for (const [i, file] of files.entries()) {
      const n = files.length > 1 ? ` (${i + 1}/${files.length})` : ""
      try {
        setBusy(`${file.name} uploaden${n}…`)
        const id = await uploadDocumentFile({ file, dossierId, type, applicantPosition: position, local })
        setBusy(`${file.name} uitlezen${n}…`)
        const r = await quickExtractAction(id, dossierId)
        if (!r.ok) toast.error(`${file.name}: ${r.error}`)
        onExtracted(r)
      } catch (err) {
        toast.error((err as Error).message || "Uploaden is mislukt.")
      }
    }
    setBusy(null)
    router.refresh()
  }
  return (
    <div>
      <input
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        aria-label={`${label} (aanvrager ${position})`}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ""
          if (files.length) void onFiles(files)
        }}
        disabled={!!busy}
      />
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted has-[:focus-visible]:ring-3",
          busy && "pointer-events-none opacity-70"
        )}
      >
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <FileUp aria-hidden className="size-4" />}
        {busy ?? label}
      </label>
    </div>
  )
}

function DocList({ docs, dossierId }: { docs: QuickDocView[]; dossierId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (docs.length === 0) return null
  return (
    <ul className="divide-y rounded-lg border text-sm">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-2 px-3 py-2">
          {d.status === "failed" ? (
            <AlertTriangle aria-hidden className="size-4 shrink-0 text-amber-600" />
          ) : d.status === "extracted" || d.status === "confirmed" ? (
            <CheckCircle2 aria-hidden className="size-4 shrink-0 text-green-600" />
          ) : (
            <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
          )}
          <span className="min-w-0 flex-1 truncate">
            {d.fileName}
            <span className="ml-2 text-xs text-muted-foreground">
              {d.kind === "financials" ? "jaarcijfers" : "salaris"}
              {d.status === "failed" ? ` — ${d.error ?? "niet uitgelezen, vul zelf in"}` : ""}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${d.fileName} verwijderen`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteDocumentAction(d.id, dossierId)
                if (!r.ok) toast.error(r.error)
                router.refresh()
              })
            }
          >
            <Trash2 aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  )
}

const ROLE: Record<string, string> = { holding: "holding", werkmaatschappij: "werkmaatschappij", geconsolideerd: "geconsolideerd", eenmanszaak: "eenmanszaak", onbekend: "" }
const FORM: Record<string, string> = { eenmanszaak: "Eenmanszaak / IB-ondernemer", bv: "BV", bv_holding: "BV met holding" }
const LIMITING: Record<string, string> = { winstcapaciteit: "winstcapaciteit", solvabiliteit: "solvabiliteit", liquiditeit: "liquiditeit", uitkeringstoets: "vrij uitkeerbare reserves" }

/** Toetsinkomen uit de jaarcijfers, live doorgerekend met de rekenkern (gemiddelde bank en per bank). */
function EntrepreneurIncome({
  f,
  dossierId,
  control,
  index,
  calcYear,
  lenders,
  gebruikelijkLoon,
}: {
  f: QuickFinancialsView
  dossierId: string
  control: Control<QuickForm>
  index: number
  calcYear: number
  lenders: WorkbenchLender[]
  gebruikelijkLoon: number
}) {
  const applicant = useWatch({ control, name: `applicants.${index}` })
  const results = useMemo(() => {
    try {
      const { business } = quickBusiness(f.existing ?? undefined, f.merged, applicant, calcYear)
      if (!business) return []
      const input = businessToEngine(business)
      const norms = { ondernemer: { gebruikelijkLoon } } as NormValues
      return [{ slug: "__standaard", name: "Gemiddelde bank", policy: {} }, ...lenders].map((lender) => ({
        lender,
        r: businessIncome(input, withDefaults(lender.policy as LenderEntrepreneurPolicy), norms),
      }))
    } catch {
      return []
    }
  }, [f, applicant, calcYear, lenders, gebruikelijkLoon])

  const main = f.entities.find((e) => e.role !== "geconsolideerd" && e.role !== "holding") ?? f.entities[0]
  const years = (main?.years ?? []).filter((y) => !y.forecast).map((y) => y.year)
  const last = years.length ? Math.max(...years) : calcYear - 1
  const missing = [last - 2, last - 1, last].filter((y) => !years.includes(y))
  const std = results[0]?.r
  const banks = results.slice(1).filter((x) => x.r.accepted !== false)
  const incomes = banks.map((x) => x.r.income)

  return (
    <div className="space-y-3 rounded-lg bg-muted/40 p-3 text-sm">
      <p className="font-medium">
        Onderneming: {FORM[f.legalForm ?? ""] ?? "onbekend"}
        <span className="font-normal text-muted-foreground">
          {" "}
          · {f.fileCount} {f.fileCount === 1 ? "bestand" : "bestanden"}
        </span>
      </p>
      <ul className="space-y-1">
        {f.entities.map((e) => (
          <li key={e.name}>
            <span className="font-medium">{e.name}</span>
            {ROLE[e.role] ? <span className="text-muted-foreground"> ({ROLE[e.role]})</span> : null}
            <span className="block text-xs text-muted-foreground tabular-nums">
              {e.years
                .filter((y) => !y.forecast)
                .map((y) => `${y.year}: ${y.result === null ? "–" : formatEuro(y.result)}`)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      {missing.length > 0 ? (
        <p className="flex gap-1.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          Banken kijken meestal naar 3 jaar. Upload ook de cijfers over {missing.join(" en ")}.
        </p>
      ) : null}
      {f.conflicts.length > 0 ? (
        <p className="flex gap-1.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          {f.conflicts.length} verschil(len) tussen bestanden; de waarde met de hoogste zekerheid is gebruikt.
        </p>
      ) : null}

      {std ? (
        <div className="space-y-2 rounded-lg border bg-background p-3" data-testid="quick-toetsinkomen">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">Toetsinkomen onderneming</span>
            <span className="text-lg font-semibold tabular-nums">{formatEuro(std.income)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Bij een gemiddelde bank
            {incomes.length > 0 ? `; bij ${incomes.length} banken tussen ${formatEuro(Math.min(...incomes))} en ${formatEuro(Math.max(...incomes))}` : ""}.
            {std.dga?.tests ? ` Beperkt door: ${LIMITING[std.dga.tests.limitingTest] ?? std.dga.tests.limitingTest}.` : ""}
          </p>
          {std.dga ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-xs">
              <dt className="text-muted-foreground">Salaris DGA dat meetelt</dt>
              <dd className="text-right tabular-nums">{formatEuro(std.dga.salaryCounted)}</dd>
              <dt className="text-muted-foreground">Jouw deel uitkeerbare winst</dt>
              <dd className="text-right tabular-nums">{formatEuro(std.dga.distributableShare)}</dd>
            </dl>
          ) : null}
          {std.warnings.slice(0, 3).map((w) => (
            <p key={w} className="flex gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle aria-hidden className="size-4 shrink-0" /> {w}
            </p>
          ))}
          {std.explanation.length > 0 ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Hoe is dit berekend?</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {std.explanation.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
      <Link href={`/app/dossiers/${dossierId}/ondernemer`} className="text-xs underline">
        Toetsinkomen per bank bekijken of cijfers aanpassen
      </Link>
    </div>
  )
}

// ----------------------------------------------------------------------------- huidige woning

function CurrentHome({ control, calcYear }: { control: Control<QuickForm>; calcYear: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: "currentHome.loanParts", keyName: "_key" })
  return (
    <FieldGroup title="Huidige woning en hypotheek" description="Staat op je jaaroverzicht van de hypotheek.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyField control={control} name="currentHome.marketValue" label="Waarde woning" help="Wat je denkt dat hij nu waard is." />
        <MoneyField control={control} name="currentHome.wozValue" nullable label="WOZ-waarde (optioneel)" />
        <NumberField control={control} name="currentHome.mortgageStartYear" label="Hypotheek afgesloten in" step={1} min={1960} max={calcYear} />
        <SelectField control={control} name="currentHome.energyLabel" label="Energielabel" options={LABEL_OPTIONS} />
      </div>
      <div className="space-y-3">
        {fields.map((f, i) => (
          <div key={f._key} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_7rem_1fr_auto]">
            <SelectField control={control} name={`currentHome.loanParts.${i}.type`} label={`Leningdeel ${i + 1}`} options={LOAN_OPTIONS} />
            <MoneyField control={control} name={`currentHome.loanParts.${i}.balance`} label="Restschuld" />
            <NumberField control={control} name={`currentHome.loanParts.${i}.ratePct`} label="Rente" unit="%" step={0.01} />
            <TextField control={control} name={`currentHome.loanParts.${i}.fixedRateEndDate`} label="Rentevast tot" type="date" />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Leningdeel ${i + 1} verwijderen`} onClick={() => remove(i)} disabled={fields.length === 1}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLoanPart(calcYear))} disabled={fields.length >= 6}>
          <Plus aria-hidden /> Leningdeel toevoegen
        </Button>
      </div>
    </FieldGroup>
  )
}
