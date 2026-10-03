"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Calculator, CheckCircle2, FileUp, Loader2, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState, useTransition } from "react"
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormSetValue } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CheckboxField, FieldGroup, MoneyField, NumberField, SelectField, TextField } from "@/components/forms/fields"
import { uploadDocumentFile } from "@/components/documents/upload-file"
import { deleteDocumentAction } from "@/app/app/dossiers/[id]/documenten/actions"
import { quickCalculateAction, quickExtractAction, saveQuickDraftAction } from "@/app/app/dossiers/[id]/start/actions"
import { ACCEPT_ATTR } from "@/lib/documents/types"
import { formatEuro } from "@/lib/format"
import { GOAL_OPTIONS } from "@/lib/intake/goals"
import { ENERGY_LABELS } from "@/lib/intake/schema"
import { CURRENT_HOME_GOALS, emptyLoanPart, emptyQuickApplicant, quickForm, TARGET_HOME_GOALS, type QuickForm } from "@/lib/quick/quick"
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
}: {
  dossierId: string
  defaults: QuickForm
  docs: QuickDocView[]
  financials: (QuickFinancialsView | null)[]
  calcYear: number
  local: boolean
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
}: {
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
          Loonstrook of werkgeversverklaring (pdf of foto). Ondernemer? Upload je jaarrekeningen of een Excel-overzicht van de laatste 3 jaar. We lezen alles automatisch uit.
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

      {financials ? <FinancialsSummary f={financials} dossierId={dossierId} /> : null}
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
    for (const file of files) {
      try {
        setBusy(`${file.name} uploaden…`)
        const id = await uploadDocumentFile({ file, dossierId, type, applicantPosition: position, local })
        setBusy(`${file.name} uitlezen…`)
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

function FinancialsSummary({ f, dossierId }: { f: QuickFinancialsView; dossierId: string }) {
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
      <p className="font-medium">Onderneming: {FORM[f.legalForm ?? ""] ?? "onbekend"}</p>
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
      {f.conflicts.length > 0 || f.warnings.length > 0 ? (
        <p className="flex gap-1.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          {f.conflicts.length > 0 ? `${f.conflicts.length} verschil(len) tussen bestanden.` : f.warnings[0]}
        </p>
      ) : null}
      <Link href={`/app/dossiers/${dossierId}/ondernemer`} className="text-xs underline">
        Cijfers controleren of aanpassen
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
