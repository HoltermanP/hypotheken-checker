import type { IntakeData, StepKey } from "./schema"

/**
 * Welke stappen van de wizard gelden voor dit dossier (conditionele vragen).
 */

export interface StepMeta {
  key: StepKey
  title: string
  description: string
  optional?: boolean
}

export const STEPS: StepMeta[] = [
  { key: "doel", title: "Doel", description: "Wat wil je doen?" },
  { key: "persoonlijk", title: "Persoonlijk", description: "Jij en eventueel je partner" },
  { key: "inkomen", title: "Inkomen", description: "Loondienst, uitkering, pensioen of onderneming" },
  { key: "ondernemer", title: "Onderneming", description: "Cijfers van je onderneming" },
  { key: "verplichtingen", title: "Verplichtingen", description: "Leningen, lease en studieschuld" },
  { key: "vermogen", title: "Vermogen", description: "Spaargeld, schenking en buffer" },
  { key: "huidige-woning", title: "Huidige woning", description: "Waarde en hypotheekdelen" },
  { key: "nieuwe-woning", title: "Nieuwe woning", description: "De woning die je wilt kopen" },
  { key: "voorkeuren", title: "Voorkeuren", description: "Rentevast, aflossing en NHG" },
  { key: "risicos", title: "Risico's", description: "Verzekeringen en vooruitzichten" },
  { key: "overzicht", title: "Overzicht", description: "Controleren en berekenen" },
]

const CURRENT_HOME_GOALS = new Set(["doorstromer", "oversluiten", "verhogen", "verkopen"])
const TARGET_HOME_GOALS = new Set(["starter", "doorstromer", "orientatie"])

export function applicableSteps(intake: IntakeData): StepMeta[] {
  const goal = intake.doel?.goal
  const entrepreneur = intake.inkomen?.applicants.some((a) => a.isEntrepreneur) ?? false
  const owner = intake.persoonlijk?.applicants.some((a) => a.previousHomeOwner) ?? false
  return STEPS.filter((s) => {
    if (s.key === "ondernemer") return entrepreneur
    if (s.key === "huidige-woning") return goal ? CURRENT_HOME_GOALS.has(goal) || (goal === "orientatie" && owner) : false
    if (s.key === "nieuwe-woning") return goal ? TARGET_HOME_GOALS.has(goal) : false
    return true
  }).map((s) => (s.key === "nieuwe-woning" && goal === "orientatie" ? { ...s, optional: true } : s))
}

export function stepIndex(intake: IntakeData, key: StepKey): number {
  return applicableSteps(intake).findIndex((s) => s.key === key)
}

export function nextStep(intake: IntakeData, key: StepKey): StepKey | null {
  const steps = applicableSteps(intake)
  const i = steps.findIndex((s) => s.key === key)
  return steps[i + 1]?.key ?? null
}

export function prevStep(intake: IntakeData, key: StepKey): StepKey | null {
  const steps = applicableSteps(intake)
  const i = steps.findIndex((s) => s.key === key)
  return i > 0 ? steps[i - 1]!.key : null
}

/** Ontbrekende verplichte stappen (voor 'Bereken advies'). */
export function missingSteps(intake: IntakeData, skipped: string[] = []): StepMeta[] {
  return applicableSteps(intake).filter(
    (s) => s.key !== "overzicht" && !s.optional && !skipped.includes(s.key) && intake[s.key as keyof IntakeData] === undefined
  )
}
