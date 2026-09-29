import { notFound, redirect } from "next/navigation"
import { requireUserIdOrRedirect } from "@/lib/auth"
import {
  defaultAssets,
  defaultCurrentHome,
  defaultEntrepreneur,
  defaultIncome,
  defaultObligations,
  defaultPersonal,
  defaultPreferences,
  defaultRisks,
  defaultTargetHome,
  defaultBusiness,
} from "@/lib/intake/defaults"
import type { IntakeData, StepKey } from "@/lib/intake/schema"
import { applicableSteps, prevStep } from "@/lib/intake/steps"
import { loadIntake, NotFoundError } from "@/lib/services/dossiers"
import { Stepper } from "@/components/intake/stepper"
import { IntakeOverview } from "@/components/intake/overview"
import { GoalStepForm } from "@/components/intake/steps/goal-step"
import { PersonalStepForm } from "@/components/intake/steps/personal-step"
import { IncomeStepForm } from "@/components/intake/steps/income-step"
import { EntrepreneurStepForm } from "@/components/intake/steps/entrepreneur-step"
import { ObligationsStepForm } from "@/components/intake/steps/obligations-step"
import { AssetsStepForm } from "@/components/intake/steps/assets-step"
import { CurrentHomeStepForm } from "@/components/intake/steps/current-home-step"
import { TargetHomeStepForm } from "@/components/intake/steps/target-home-step"
import { PreferencesStepForm } from "@/components/intake/steps/preferences-step"
import { RisksStepForm } from "@/components/intake/steps/risks-step"

export const metadata = { title: "Intake" }

function resize<T>(list: T[], n: number, make: () => T): T[] {
  return list.length >= n ? list.slice(0, n) : [...list, ...Array.from({ length: n - list.length }, make)]
}

export default async function IntakeStepPage({ params }: PageProps<"/app/dossiers/[id]/intake/[step]">) {
  const { id, step } = await params
  const userId = await requireUserIdOrRedirect()
  let loaded
  try {
    loaded = await loadIntake(userId, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  const { intake, drafts, skipped, completedSteps } = loaded
  const steps = applicableSteps(intake)
  const meta = steps.find((s) => s.key === step)
  if (!meta) redirect(`/app/dossiers/${id}/intake/${steps[0]!.key}`)
  const key = meta.key as StepKey
  const prev = prevStep(intake, key)
  const count = intake.persoonlijk?.hasPartner ? 2 : 1
  const calcYear = new Date().getFullYear()
  const names = (intake.persoonlijk?.applicants ?? []).map((a, i) => a.firstName || (i === 0 ? "Jij" : "Je partner"))
  const entrepreneurs = (intake.inkomen?.applicants ?? []).map((a) => a.isEntrepreneur)
  const isDga = (intake.ondernemer?.applicants ?? []).some((a) => a.businesses.some((b) => b.legalForm === "bv" || b.legalForm === "bv_holding"))
  const context = { goal: intake.doel?.goal ?? "orientatie", hasPartner: count === 2, names, calcYear, isDga, entrepreneurs }
  const pick = <K extends keyof IntakeData>(k: K, fallback: () => NonNullable<IntakeData[K]>): NonNullable<IntakeData[K]> =>
    ((drafts[k] as IntakeData[K]) ?? intake[k] ?? fallback()) as NonNullable<IntakeData[K]>
  const common = { dossierId: id, prev, optional: meta.optional, context }

  let body: React.ReactNode
  switch (key) {
    case "doel":
      body = <GoalStepForm {...common} defaults={pick("doel", () => ({ goal: "orientatie", title: "" }))} />
      break
    case "persoonlijk":
      body = <PersonalStepForm {...common} defaults={pick("persoonlijk", defaultPersonal)} />
      break
    case "inkomen": {
      const d = pick("inkomen", () => defaultIncome(count))
      body = <IncomeStepForm {...common} defaults={{ applicants: resize(d.applicants, count, () => defaultIncome(1).applicants[0]!) }} />
      break
    }
    case "ondernemer": {
      const d = pick("ondernemer", () => defaultEntrepreneur(intake, calcYear))
      const apps = resize(d.applicants, count, () => ({ businesses: [] })).map((a, i) =>
        entrepreneurs[i] && a.businesses.length === 0 ? { businesses: [defaultBusiness(calcYear)] } : a
      )
      body = <EntrepreneurStepForm {...common} defaults={{ applicants: apps }} />
      break
    }
    case "verplichtingen":
      body = <ObligationsStepForm {...common} defaults={pick("verplichtingen", defaultObligations)} />
      break
    case "vermogen":
      body = <AssetsStepForm {...common} defaults={pick("vermogen", defaultAssets)} />
      break
    case "huidige-woning":
      body = <CurrentHomeStepForm {...common} defaults={pick("huidige-woning", defaultCurrentHome)} />
      break
    case "nieuwe-woning":
      body = <TargetHomeStepForm {...common} defaults={pick("nieuwe-woning", defaultTargetHome)} />
      break
    case "voorkeuren":
      body = <PreferencesStepForm {...common} defaults={pick("voorkeuren", defaultPreferences)} />
      break
    case "risicos": {
      const d = pick("risicos", () => defaultRisks(count))
      body = <RisksStepForm {...common} defaults={{ ...d, applicants: resize(d.applicants, count, () => defaultRisks(1).applicants[0]!) }} />
      break
    }
    case "overzicht":
      body = <IntakeOverview dossierId={id} intake={intake} skipped={skipped} />
      break
  }

  return (
    <div className="space-y-6">
      <Stepper dossierId={id} steps={steps} current={key} completed={completedSteps} />
      <div>
        <h2 className="text-xl font-semibold">{meta.title}</h2>
        <p className="text-sm text-muted-foreground">{meta.description}</p>
      </div>
      {body}
    </div>
  )
}
