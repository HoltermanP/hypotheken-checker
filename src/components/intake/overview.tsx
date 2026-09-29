import Link from "next/link"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import type { IntakeData } from "@/lib/intake/schema"
import { applicableSteps, missingSteps } from "@/lib/intake/steps"
import { formatEuro } from "@/lib/format"
import { CalculateButton } from "./calculate-button"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export function IntakeOverview({ dossierId, intake, skipped }: { dossierId: string; intake: IntakeData; skipped: string[] }) {
  const missing = missingSteps(intake, skipped)
  const steps = applicableSteps(intake).filter((s) => s.key !== "overzicht")
  const incomeTotal = (intake.inkomen?.applicants ?? []).reduce(
    (s, a) =>
      s +
      a.incomes.reduce(
        (t, i) =>
          t +
          (i.kind === "employment" ? i.grossAnnualSalary + i.holidayPay + i.thirteenthMonth + i.fixedYearEndBonus + i.irregularityAllowance + i.commission : i.grossAnnual),
        0
      ),
    0
  )
  return (
    <div className="space-y-6">
      {missing.length > 0 ? (
        <div role="alert" className="flex gap-3 rounded-lg border border-amber-500/50 bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
          <AlertCircle aria-hidden className="size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Nog niet alles ingevuld</p>
            <ul className="mt-1 list-disc pl-5">
              {missing.map((s) => (
                <li key={s.key}>
                  <Link className="underline" href={`/app/dossiers/${dossierId}/intake/${s.key}`}>{s.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 aria-hidden className="size-5" /> Alle stappen zijn ingevuld. Je kunt je advies berekenen.
        </p>
      )}
      <dl className="grid gap-x-8 sm:grid-cols-2">
        <Row label="Aantal aanvragers" value={intake.persoonlijk?.hasPartner ? "2" : "1"} />
        <Row label="Bruto inkomen (loondienst e.d.)" value={formatEuro(incomeTotal)} />
        <Row label="Ondernemer" value={intake.inkomen?.applicants.some((a) => a.isEntrepreneur) ? "ja" : "nee"} />
        <Row label="Verplichtingen" value={String(intake.verplichtingen?.obligations.length ?? 0)} />
        <Row label="Spaargeld" value={formatEuro(intake.vermogen?.savings ?? 0)} />
        {intake["nieuwe-woning"] ? <Row label="Koopsom nieuwe woning" value={formatEuro(intake["nieuwe-woning"].purchasePrice)} /> : null}
        {intake["huidige-woning"] ? <Row label="Waarde huidige woning" value={formatEuro(intake["huidige-woning"].marketValue)} /> : null}
        {intake.voorkeuren ? <Row label="Rentevaste periode" value={`${intake.voorkeuren.fixedRateYears} jaar`} /> : null}
      </dl>
      <div className="flex flex-wrap gap-2 text-sm">
        {steps.map((s) => (
          <Link key={s.key} href={`/app/dossiers/${dossierId}/intake/${s.key}`} className="rounded-full border px-3 py-1 hover:bg-muted">
            {s.title} wijzigen
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Tip: upload eerst je documenten (werkgeversverklaring, salarisstrook, jaarcijfers). We controleren dan je gegevens en het rapport wordt betrouwbaarder.{" "}
        <Link className="underline" href={`/app/dossiers/${dossierId}/documenten`}>Naar documenten</Link>
      </p>
      <CalculateButton dossierId={dossierId} disabled={missing.length > 0} />
    </div>
  )
}
