"use client"

import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/forms/fields"
import { uploadDocumentFile } from "@/components/documents/upload-file"
import { deleteDocumentAction, extractAction } from "@/app/app/dossiers/[id]/documenten/actions"
import { applyFinancialsAction } from "@/app/app/dossiers/[id]/ondernemer/actions"
import { applyFinancialsToBusiness } from "@/lib/documents/apply-financials"
import { FIN_FIELDS, type FinFieldKey, type MergedEntity, type MergedFinancials } from "@/lib/documents/financials"
import { ACCEPT_ATTR } from "@/lib/documents/types"
import { businessIncome, withDefaults, type BusinessIncome } from "@/lib/engine/entrepreneur"
import type { LenderEntrepreneurPolicy } from "@/lib/engine/lenders/types"
import type { NormValues } from "@/lib/engine/norms"
import { formatEuro, formatPct } from "@/lib/format"
import { defaultBusiness } from "@/lib/intake/defaults"
import type { BusinessForm } from "@/lib/intake/schema"
import { businessToEngine } from "@/lib/intake/to-engine"
import type { FinancialsDocView } from "@/lib/services/entrepreneur-financials"

export interface WorkbenchApplicant {
  position: number
  name: string
  businesses: BusinessForm[]
  merged: MergedFinancials
}

export interface WorkbenchLender {
  slug: string
  name: string
  policy: Partial<LenderEntrepreneurPolicy>
}

const ROLE_LABEL: Record<MergedEntity["role"], string> = {
  werkmaatschappij: "Werkmaatschappij",
  holding: "Holding",
  geconsolideerd: "Geconsolideerd",
  eenmanszaak: "Eenmanszaak / IB",
  onbekend: "Onbekend",
}

const SOURCE_LABEL = { template: "sjabloon", ai: "AI", manual: "handmatig" } as const

const DOC_KIND: Record<string, string> = {
  jaarrekening: "jaarrekening",
  excel_overzicht: "Excel-overzicht",
  jaaroverzicht_dga: "jaaroverzicht DGA",
  ib_aangifte: "IB-aangifte",
  vpb_aangifte: "Vpb-aangifte",
  overig: "overig",
}

const LIMITING: Record<string, string> = {
  winstcapaciteit: "winstcapaciteit",
  solvabiliteit: "solvabiliteit",
  liquiditeit: "liquiditeit",
  uitkeringstoets: "vrij uitkeerbare reserves",
}

const LEGAL_LABEL: Record<string, string> = {
  eenmanszaak: "Eenmanszaak",
  vof: "Vof",
  maatschap: "Maatschap",
  cv: "Cv",
  bv: "BV",
  bv_holding: "BV met holding",
}

function businessLabel(b: BusinessForm, i: number) {
  return `${b.name || `Onderneming ${i + 1}`} (${LEGAL_LABEL[b.legalForm] ?? b.legalForm})`
}

// ----------------------------------------------------------------------------- bestanden

function FileList({ docs, dossierId }: { docs: FinancialsDocView[]; dossierId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (docs.length === 0) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nog geen bestanden. Je kunt de cijfers ook hieronder zelf invullen.</p>
  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li key={d.id} className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{d.fileName}</span>
            {d.documentKind ? <Badge variant="outline">{DOC_KIND[d.documentKind] ?? d.documentKind}</Badge> : null}
            {d.source ? <Badge variant="secondary">{SOURCE_LABEL[d.source]}</Badge> : null}
            {d.status === "confirmed" ? (
              <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                <CheckCircle2 aria-hidden className="size-4" /> overgenomen
              </span>
            ) : d.status === "extracting" || d.status === "uploaded" ? (
              <Badge variant="outline">wordt uitgelezen</Badge>
            ) : d.status === "failed" ? (
              <Badge variant="outline" className="border-amber-500">niet gelukt</Badge>
            ) : null}
            <span className="text-muted-foreground">
              {d.years.length ? `jaren ${d.years.join(", ")}` : ""}
              {d.entities.length ? ` · ${d.entities.join(", ")}` : ""}
            </span>
            <div className="ml-auto flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`${d.fileName} opnieuw uitlezen`}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await extractAction(d.id, dossierId)
                    if (!r.ok) toast.error(r.error)
                    router.refresh()
                  })
                }
              >
                {pending ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`${d.fileName} verwijderen`}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!window.confirm("Bestand definitief verwijderen?")) return
                    const r = await deleteDocumentAction(d.id, dossierId)
                    if (!r.ok) toast.error(r.error)
                    router.refresh()
                  })
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          </div>
          {d.error ? <p className="mt-1 text-amber-800 dark:text-amber-300">{d.error}</p> : null}
          {d.warnings.map((w) => (
            <p key={w} className="mt-1 text-amber-800 dark:text-amber-300">{w}</p>
          ))}
        </li>
      ))}
    </ul>
  )
}

function MultiUpload({ dossierId, position, local }: { dossierId: string; position: number; local: boolean }) {
  const inputId = useId()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  async function onFiles(files: File[]) {
    for (const file of files) {
      setBusy(file.name)
      try {
        const id = await uploadDocumentFile({ file, dossierId, type: "jaarcijfers_onderneming", applicantPosition: position, local })
        router.refresh()
        const r = await extractAction(id, dossierId)
        if (r.ok) toast.success(`${file.name} is uitgelezen.`)
        else toast.error(`${file.name}: ${r.error}`)
      } catch (err) {
        toast.error((err as Error).message || `${file.name}: uploaden mislukt.`)
      }
    }
    setBusy(null)
    router.refresh()
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={inputId} className="sr-only">
        Bestanden met jaarcijfers uploaden
      </Label>
      <input
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        disabled={!!busy}
        onChange={(e) => {
          const list = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (list.length) void onFiles(list)
        }}
      />
      <Button type="button" disabled={!!busy} onClick={() => document.getElementById(inputId)?.click()}>
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : <FileUp aria-hidden />}
        {busy ? `Bezig met ${busy}…` : "Bestanden uploaden"}
      </Button>
      <a href="/api/templates/jaarcijfers" className="inline-flex items-center gap-1 text-sm font-medium underline">
        <Download aria-hidden className="size-4" /> Excel-sjabloon downloaden
      </a>
    </div>
  )
}

// ----------------------------------------------------------------------------- bewerkbare cijfers

function EntityEditor({
  entity,
  onChange,
  onRemove,
}: {
  entity: MergedEntity
  onChange: (e: MergedEntity) => void
  onRemove: () => void
}) {
  const uid = useId()
  const years = [...entity.years].sort((a, b) => a.year - b.year)
  const setValue = (year: number, key: FinFieldKey, v: number | null) =>
    onChange({
      ...entity,
      years: entity.years.map((y) => {
        if (y.year !== year) return y
        const values = { ...y.values }
        if (v === null) delete values[key]
        else values[key] = { value: v, confidence: 1, sourceIds: values[key]?.sourceIds ?? [] }
        return { ...y, values }
      }),
    })
  const addYear = () => {
    const last = years.at(-1)?.year ?? new Date().getFullYear() - 1
    const next = years.length ? (years.some((y) => y.year === last + 1) ? last + 2 : last + 1) : last
    const year = years.length && next > new Date().getFullYear() ? (years[0]!.year - 1) : next
    onChange({ ...entity, years: [...entity.years, { year, isForecast: false, values: {} }] })
  }
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_0.7fr_1.2fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor={`${uid}-name`}>Naam</Label>
          <Input id={`${uid}-name`} value={entity.name} maxLength={80} onChange={(e) => onChange({ ...entity, name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${uid}-role`}>Rol</Label>
          <select
            id={`${uid}-role`}
            className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
            value={entity.role}
            onChange={(e) => onChange({ ...entity, role: e.target.value as MergedEntity["role"] })}
          >
            {Object.entries(ROLE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${uid}-own`}>Belang (%)</Label>
          <Input
            id={`${uid}-own`}
            type="number"
            min={0}
            max={100}
            value={entity.ownershipPct ?? ""}
            onChange={(e) => onChange({ ...entity, ownershipPct: e.target.value === "" ? null : Math.min(100, Math.max(0, Number(e.target.value))) })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${uid}-parent`}>Aandeelhouder</Label>
          <Input id={`${uid}-parent`} value={entity.parentName ?? ""} placeholder="DGA of naam holding" maxLength={80} onChange={(e) => onChange({ ...entity, parentName: e.target.value || null })} />
        </div>
        <Button type="button" size="sm" variant="ghost" aria-label={`${entity.name} verwijderen`} onClick={onRemove}>
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">Jaarcijfers {entity.name}</caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-1 pr-2 font-medium">Post</th>
              {years.map((y) => (
                <th key={y.year} scope="col" className="px-1 py-1 text-right font-medium">
                  {y.year}
                  {y.isForecast ? <span className="block text-xs font-normal text-muted-foreground">prognose</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIN_FIELDS.map((f) => (
              <tr key={f.key} className="border-b last:border-0">
                <th scope="row" className="py-1 pr-2 text-left font-normal">{f.label}</th>
                {years.map((y) => {
                  const cell = y.values[f.key]
                  return (
                    <td key={y.year} className="px-1 py-0.5">
                      <div className={cell && cell.confidence < 0.6 ? "rounded-md ring-1 ring-amber-500" : undefined} title={cell && cell.confidence < 0.6 ? "Onzeker: controleer" : undefined}>
                        <MoneyInput
                          id={`${uid}-${f.key}-${y.year}`}
                          value={cell?.value ?? null}
                          allowNegative
                          onChange={(v) => setValue(y.year, f.key, v)}
                        />
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={addYear}>
        <Plus aria-hidden /> Jaar toevoegen
      </Button>
    </div>
  )
}

// ----------------------------------------------------------------------------- toetsinkomen per bank

function BankTable({ results, selected, onSelect }: { results: { lender: WorkbenchLender; r: BusinessIncome }[]; selected: string; onSelect: (s: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">Toetsinkomen per bank</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2 pr-2 font-medium">Bank</th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">Toetsinkomen</th>
            <th scope="col" className="py-2 pr-2 font-medium">Beperkende toets</th>
            <th scope="col" className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map(({ lender, r }) => (
            <tr key={lender.slug} className={`border-b last:border-0 ${selected === lender.slug ? "bg-muted/50" : ""}`}>
              <td className="py-1.5 pr-2">
                <button type="button" className="text-left underline-offset-2 hover:underline" aria-pressed={selected === lender.slug} onClick={() => onSelect(lender.slug)}>
                  {lender.name}
                </button>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{formatEuro(r.income)}</td>
              <td className="py-1.5 pr-2">{r.dga?.tests ? LIMITING[r.dga.tests.limitingTest] : r.dga?.treatedAsEmployee ? "alleen salaris" : r.method === "ivo" ? "IVO" : "—"}</td>
              <td className="py-1.5">
                {r.accepted === true ? <Badge variant="secondary">past</Badge> : r.accepted === false ? <Badge variant="outline" className="border-destructive text-destructive">niet</Badge> : <Badge variant="outline">onzeker</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Breakdown({ r, name }: { r: BusinessIncome; name: string }) {
  const d = r.dga
  return (
    <div className="space-y-3 rounded-xl border p-4 text-sm">
      <h3 className="font-semibold">Opbouw bij {name}</h3>
      {d ? (
        <>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <dt className="text-muted-foreground">Salaris DGA (laatste jaar)</dt>
            <dd className="tabular-nums">{formatEuro(d.salary)}</dd>
            <dt className="text-muted-foreground">Salaris dat meetelt</dt>
            <dd className="tabular-nums">{formatEuro(d.salaryCounted)}</dd>
            {d.tests ? (
              <>
                <dt className="text-muted-foreground">Winstcapaciteit ({d.consolidated ? "geconsolideerd" : "werkmaatschappij"})</dt>
                <dd className="tabular-nums">{formatEuro(d.tests.profitCapacity)}</dd>
                <dt className="text-muted-foreground">Max. volgens solvabiliteit ({formatPct(d.tests.solvencyPct, 1)}, min. {d.tests.minSolvencyPct}%)</dt>
                <dd className="tabular-nums">{formatEuro(d.tests.maxBySolvency)}</dd>
                <dt className="text-muted-foreground">
                  Max. volgens liquiditeit (current ratio {Number.isFinite(d.tests.currentRatio) ? d.tests.currentRatio.toFixed(2) : "∞"}, min. {d.tests.minCurrentRatio})
                </dt>
                <dd className="tabular-nums">{formatEuro(d.tests.maxByLiquidity)}</dd>
                <dt className="text-muted-foreground">Max. vrij uitkeerbare reserves</dt>
                <dd className="tabular-nums">{formatEuro(d.tests.maxByReserves)}</dd>
                <dt className="text-muted-foreground">Uitkeerbaar (laagste toets: {LIMITING[d.tests.limitingTest]})</dt>
                <dd className="tabular-nums">{formatEuro(d.tests.distributable)}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Jouw deel{d.shareholdingPct !== undefined ? ` (${d.shareholdingPct}%)` : ""}</dt>
            <dd className="tabular-nums">{formatEuro(d.distributableShare)}</dd>
            <dt className="font-medium">Toetsinkomen</dt>
            <dd className="font-medium tabular-nums">{formatEuro(r.income)}</dd>
          </dl>
          {d.tests && d.tests.years.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem]">
                <caption className="py-1 text-left font-medium">Genormaliseerd resultaat na belasting</caption>
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="py-1 font-medium">Jaar</th>
                    <th scope="col" className="py-1 text-right font-medium">Resultaat</th>
                    <th scope="col" className="py-1 text-right font-medium">Incidenteel (na belasting)</th>
                    <th scope="col" className="py-1 text-right font-medium">Genormaliseerd</th>
                  </tr>
                </thead>
                <tbody>
                  {d.tests.years.map((y) => (
                    <tr key={y.year} className="border-b last:border-0">
                      <td className="py-1">{y.year}</td>
                      <td className="py-1 text-right tabular-nums">{formatEuro(y.resultAfterTax)}</td>
                      <td className="py-1 text-right tabular-nums">{y.incidentalAfterTax ? formatEuro(-y.incidentalAfterTax) : "—"}</td>
                      <td className="py-1 text-right tabular-nums">{formatEuro(y.normalized)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : r.sole ? (
        <p>
          Toetsinkomen {formatEuro(r.income)} volgens methode {r.method}.
        </p>
      ) : null}
      <ul className="list-disc space-y-1 pl-5">
        {r.explanation.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      {r.warnings.map((w) => (
        <p key={w} className="flex gap-2 text-amber-800 dark:text-amber-300">
          <AlertTriangle aria-hidden className="size-4 shrink-0" /> {w}
        </p>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------------------- hoofdcomponent

function ApplicantWorkbench({
  dossierId,
  applicant,
  docs,
  lenders,
  gebruikelijkLoon,
  local,
}: {
  dossierId: string
  applicant: WorkbenchApplicant
  docs: FinancialsDocView[]
  lenders: WorkbenchLender[]
  gebruikelijkLoon: number
  local: boolean
}) {
  const router = useRouter()
  const uid = useId()
  const [merged, setMerged] = useState<MergedFinancials>(applicant.merged)
  const [businessId, setBusinessId] = useState<string>(applicant.businesses[0]?.id ?? "")
  const [bank, setBank] = useState<string>("__standaard")
  const [pending, start] = useTransition()

  const base = useMemo<BusinessForm>(() => {
    const found = applicant.businesses.find((b) => b.id === businessId)
    if (found) return found
    const b = defaultBusiness(new Date().getFullYear())
    b.legalForm = merged.entities.some((e) => e.role === "holding") ? "bv_holding" : merged.entities.every((e) => e.role === "eenmanszaak") && merged.entities.length > 0 ? "eenmanszaak" : "bv"
    return b
  }, [applicant.businesses, businessId, merged.entities])

  const preview = useMemo(() => {
    try {
      const business = businessToEngine(applyFinancialsToBusiness(base, merged).business)
      // De inkomenstoets gebruikt uit de normen alleen het gebruikelijk loon.
      const norms = { ondernemer: { gebruikelijkLoon } } as NormValues
      const all: WorkbenchLender[] = [{ slug: "__standaard", name: "Standaardbeleid (gemiddelde bank)", policy: {} }, ...lenders]
      return all.map((lender) => ({ lender, r: businessIncome(business, withDefaults(lender.policy as LenderEntrepreneurPolicy), norms) }))
    } catch {
      return []
    }
  }, [base, merged, lenders, gebruikelijkLoon])

  const setEntity = (i: number, e: MergedEntity) => setMerged((m) => ({ ...m, entities: m.entities.map((x, j) => (j === i ? e : x)) }))
  const removeEntity = (i: number) => setMerged((m) => ({ ...m, entities: m.entities.filter((_, j) => j !== i) }))
  const addEntity = () =>
    setMerged((m) => {
      const years = m.entities[0]?.years.map((y) => ({ year: y.year, isForecast: y.isForecast, values: {} })) ?? [1, 2, 3].map((d) => ({ year: new Date().getFullYear() - 4 + d, isForecast: false, values: {} }))
      const role: MergedEntity["role"] = m.entities.length === 0 ? "werkmaatschappij" : "holding"
      return { ...m, entities: [...m.entities, { key: `nieuw-${Date.now()}`, name: role === "holding" ? "Holding BV" : "Werk BV", role, ownershipPct: 100, parentName: null, years }] }
    })
  const salaryYears = [...new Set([...merged.entities.flatMap((e) => e.years.filter((y) => !y.isForecast).map((y) => y.year)), ...merged.salaries.map((s) => s.year)])].sort()
  const setSalary = (year: number, v: number | null) =>
    setMerged((m) => ({
      ...m,
      salaries: v === null ? m.salaries.filter((s) => s.year !== year) : [...m.salaries.filter((s) => s.year !== year), { year, amount: Math.max(0, v), sourceIds: m.salaries.find((s) => s.year === year)?.sourceIds ?? [] }].sort((a, b) => a.year - b.year),
    }))

  const apply = () =>
    start(async () => {
      const r = await applyFinancialsAction({ dossierId, applicantPosition: applicant.position, businessId: businessId || null, merged })
      if (!r.ok) return void toast.error(r.error)
      r.data.summary.forEach((s) => toast.success(s))
      r.data.errors.forEach((e) => toast.error(e))
      router.refresh()
    })

  const selected = preview.find((p) => p.lender.slug === bank) ?? preview[0]

  return (
    <div className="space-y-8">
      <section aria-labelledby={`${uid}-files`} className="space-y-3">
        <h2 id={`${uid}-files`} className="text-lg font-semibold">1. Bestanden</h2>
        <p className="text-sm text-muted-foreground">
          Upload jaarrekeningen (pdf), Excel- of CSV-overzichten en jaaroverzichten/jaaropgaven van de DGA. Je kunt meerdere bestanden tegelijk kiezen; we voegen de cijfers per entiteit en jaar samen. Het ingevulde Excel-sjabloon lezen we exact in, zonder AI.
        </p>
        <MultiUpload dossierId={dossierId} position={applicant.position} local={local} />
        <FileList docs={docs} dossierId={dossierId} />
      </section>

      <section aria-labelledby={`${uid}-review`} className="space-y-3">
        <h2 id={`${uid}-review`} className="text-lg font-semibold">2. Controleer de cijfers</h2>
        {merged.conflicts.length > 0 ? (
          <div role="alert" className="space-y-1 rounded-lg border border-amber-500 p-3 text-sm">
            <p className="font-medium">Verschillen tussen bestanden (de waarde met de hoogste zekerheid is ingevuld):</p>
            <ul className="list-disc pl-5">
              {merged.conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${uid}-business`}>Overnemen in onderneming</Label>
            <select id={`${uid}-business`} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              {applicant.businesses.map((b, i) => (
                <option key={b.id} value={b.id}>
                  {businessLabel(b, i)}
                </option>
              ))}
              <option value="">Nieuwe onderneming</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${uid}-share`}>Jouw aandelenbelang (%)</Label>
            <Input
              id={`${uid}-share`}
              type="number"
              min={0}
              max={100}
              value={merged.shareholdingPct ?? ""}
              placeholder={base.bv ? String(base.bv.shareholdingPct) : "100"}
              onChange={(e) => setMerged((m) => ({ ...m, shareholdingPct: e.target.value === "" ? null : Math.min(100, Math.max(0, Number(e.target.value))) }))}
            />
          </div>
        </div>
        {merged.entities.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen cijfers. Upload bestanden of voeg een entiteit toe.</p> : null}
        {merged.entities.map((e, i) => (
          <EntityEditor key={e.key} entity={e} onChange={(x) => setEntity(i, x)} onRemove={() => removeEntity(i)} />
        ))}
        <Button type="button" size="sm" variant="outline" onClick={addEntity} disabled={merged.entities.length >= 6}>
          <Plus aria-hidden /> Entiteit toevoegen
        </Button>
        {salaryYears.length > 0 ? (
          <div className="space-y-2 rounded-xl border p-3">
            <p className="text-sm font-medium">Brutosalaris DGA per jaar (jaaroverzicht / jaaropgave)</p>
            <div className="grid gap-2 sm:grid-cols-4">
              {salaryYears.map((y) => (
                <div key={y} className="space-y-1">
                  <Label htmlFor={`${uid}-sal-${y}`}>{y}</Label>
                  <MoneyInput id={`${uid}-sal-${y}`} value={merged.salaries.find((s) => s.year === y)?.amount ?? null} onChange={(v) => setSalary(y, v)} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending || merged.entities.length === 0} onClick={apply}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <CheckCircle2 aria-hidden />} Overnemen in intake
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setMerged(applicant.merged)}>
            Wijzigingen terugdraaien
          </Button>
        </div>
      </section>

      <section aria-labelledby={`${uid}-banks`} className="space-y-3">
        <h2 id={`${uid}-banks`} className="text-lg font-semibold">3. Toetsinkomen per bank</h2>
        <p className="text-sm text-muted-foreground">
          Rekent direct mee met de cijfers hierboven, op basis van {base.name || "de gekozen onderneming"} en het beleid per bank. Incidentele posten worden eruit gehaald; de uitkeerbare winst wordt begrensd door solvabiliteit, liquiditeit en vrij uitkeerbare reserves.
        </p>
        {preview.length > 0 ? (
          <>
            <BankTable results={preview} selected={selected?.lender.slug ?? ""} onSelect={setBank} />
            {selected ? <Breakdown r={selected.r} name={selected.lender.name} /> : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Vul eerst de cijfers in.</p>
        )}
      </section>
    </div>
  )
}

export function FinancialsWorkbench({
  dossierId,
  applicants,
  docs,
  lenders,
  gebruikelijkLoon,
  local,
}: {
  dossierId: string
  applicants: WorkbenchApplicant[]
  docs: FinancialsDocView[]
  lenders: WorkbenchLender[]
  gebruikelijkLoon: number
  local: boolean
}) {
  const [position, setPosition] = useState(1)
  const applicant = applicants.find((a) => a.position === position) ?? applicants[0]!
  const mine = docs.filter((d) => d.applicantPosition === applicant.position)
  // Nieuwe extracties → editor opnieuw beginnen met de samengevoegde cijfers.
  const version = mine.map((d) => `${d.id}:${d.status}:${d.years.join("-")}`).join("|")
  return (
    <div className="space-y-6">
      {applicants.length > 1 ? (
        <div role="tablist" aria-label="Aanvrager" className="flex gap-2">
          {applicants.map((a) => (
            <Button key={a.position} type="button" role="tab" aria-selected={a.position === position} variant={a.position === position ? "default" : "outline"} size="sm" onClick={() => setPosition(a.position)}>
              {a.name}
            </Button>
          ))}
        </div>
      ) : null}
      <ApplicantWorkbench
        key={`${applicant.position}-${version}`}
        dossierId={dossierId}
        applicant={applicant}
        docs={mine}
        lenders={lenders}
        gebruikelijkLoon={gebruikelijkLoon}
        local={local}
      />
    </div>
  )
}
