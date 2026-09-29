import "server-only"
import { randomUUID } from "node:crypto"
import { and, asc, desc, eq } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core"
import { getDb, runBatch, schema } from "@/lib/db/client"
import {
  STEP_SCHEMAS,
  type BusinessForm,
  type IntakeData,
  type StepKey,
} from "@/lib/intake/schema"

/**
 * Dossierservice. Elke functie krijgt de userId van de ingelogde gebruiker en filtert daarop
 * (autorisatie op rijniveau in de servicelaag). Een dossier van een andere gebruiker bestaat
 * voor de aanroeper simpelweg niet (NotFoundError).
 */

export class NotFoundError extends Error {
  constructor(what = "Dossier") {
    super(`${what} niet gevonden`)
  }
}

type Scoped = { dossierId: AnyPgColumn; userId: AnyPgColumn }

type General = {
  household?: unknown
  preferences?: unknown
  risks?: unknown
  bkrRegistrations?: string
  drafts?: Record<string, { at: string; data: unknown }>
  skipped?: string[]
}

export async function ensureUser(userId: string) {
  await getDb()
    .insert(schema.users)
    .values({ id: userId })
    .onConflictDoUpdate({ target: schema.users.id, set: { lastSeenAt: new Date() } })
}

export async function listDossiers(userId: string) {
  return getDb()
    .select({
      id: schema.dossiers.id,
      title: schema.dossiers.title,
      goal: schema.dossiers.goal,
      status: schema.dossiers.status,
      currentStep: schema.dossiers.currentStep,
      updatedAt: schema.dossiers.updatedAt,
    })
    .from(schema.dossiers)
    .where(eq(schema.dossiers.userId, userId))
    .orderBy(desc(schema.dossiers.updatedAt))
}

export async function createDossier(userId: string, goal: string, title: string) {
  await ensureUser(userId)
  const [d] = await getDb()
    .insert(schema.dossiers)
    .values({ userId, goal, title, status: "intake", currentStep: "persoonlijk", completedSteps: ["doel"], general: {} })
    .returning()
  return d!
}

export async function getOwnedDossier(userId: string, dossierId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(dossierId)) throw new NotFoundError()
  const [d] = await getDb()
    .select()
    .from(schema.dossiers)
    .where(and(eq(schema.dossiers.id, dossierId), eq(schema.dossiers.userId, userId)))
  if (!d) throw new NotFoundError()
  return d
}

export async function deleteDossierRow(userId: string, dossierId: string) {
  await getOwnedDossier(userId, dossierId)
  await getDb().delete(schema.dossiers).where(and(eq(schema.dossiers.id, dossierId), eq(schema.dossiers.userId, userId)))
}

// ----------------------------------------------------------------------------- laden

export interface LoadedIntake {
  dossier: Awaited<ReturnType<typeof getOwnedDossier>>
  intake: IntakeData
  drafts: Record<string, unknown>
  skipped: string[]
  completedSteps: string[]
}

export async function loadIntake(userId: string, dossierId: string): Promise<LoadedIntake> {
  const dossier = await getOwnedDossier(userId, dossierId)
  const db = getDb()
  const where = (t: Scoped) => and(eq(t.dossierId, dossierId), eq(t.userId, userId))
  const [applicants, incomes, obligations, assets, currents, loanParts, targets, businesses, entities, financials, guarantees, loans] =
    await Promise.all([
      db.select().from(schema.applicants).where(where(schema.applicants)).orderBy(asc(schema.applicants.position)),
      db.select().from(schema.incomes).where(where(schema.incomes)).orderBy(asc(schema.incomes.createdAt)),
      db.select().from(schema.obligations).where(where(schema.obligations)).orderBy(asc(schema.obligations.createdAt)),
      db.select().from(schema.assets).where(where(schema.assets)),
      db.select().from(schema.currentProperties).where(where(schema.currentProperties)),
      db.select().from(schema.currentLoanParts).where(where(schema.currentLoanParts)).orderBy(asc(schema.currentLoanParts.position)),
      db.select().from(schema.targetProperties).where(where(schema.targetProperties)),
      db.select().from(schema.businesses).where(where(schema.businesses)).orderBy(asc(schema.businesses.createdAt)),
      db.select().from(schema.businessEntities).where(where(schema.businessEntities)).orderBy(asc(schema.businessEntities.createdAt)),
      db.select().from(schema.businessFinancials).where(where(schema.businessFinancials)).orderBy(asc(schema.businessFinancials.year)),
      db.select().from(schema.businessGuarantees).where(where(schema.businessGuarantees)).orderBy(asc(schema.businessGuarantees.createdAt)),
      db.select().from(schema.dgaLoans).where(where(schema.dgaLoans)).orderBy(asc(schema.dgaLoans.createdAt)),
    ])
  const general = (dossier.general ?? {}) as General
  const completed = new Set(dossier.completedSteps)
  const intake: IntakeData = {}
  intake.doel = { goal: dossier.goal as NonNullable<IntakeData["doel"]>["goal"], title: dossier.title }

  if (completed.has("persoonlijk") && applicants.length > 0) {
    const h = (general.household ?? {}) as Record<string, unknown>
    intake.persoonlijk = {
      hasPartner: applicants.length > 1,
      applicants: applicants.map((a) => {
        const d = a.data as Record<string, unknown>
        return {
          firstName: d.firstName as string | undefined,
          dateOfBirth: d.dateOfBirth as string,
          previousHomeOwner: !!d.previousHomeOwner,
          usedStartersExemption: !!d.usedStartersExemption,
          yearsWorked: (d.yearsWorked as number | null | undefined) ?? null,
        }
      }),
      maritalStatus: (h.maritalStatus as NonNullable<IntakeData["persoonlijk"]>["maritalStatus"]) ?? "single",
      prenup: (h.prenup as NonNullable<IntakeData["persoonlijk"]>["prenup"]) ?? "none",
      children: (h.children as number) ?? 0,
      childrenUnder18: (h.childrenUnder18 as number) ?? 0,
    }
  }
  if (completed.has("inkomen")) {
    intake.inkomen = {
      applicants: applicants.map((a) => {
        const d = a.data as Record<string, unknown>
        return {
          incomes: incomes.filter((i) => i.applicantPosition === a.position).map((i) => i.data as never),
          isEntrepreneur: !!d.isEntrepreneur,
          expectedRetirementIncome: (d.expectedRetirementIncome as number | null | undefined) ?? null,
          alimonyPaidAnnual: (d.alimonyPaidAnnual as number) ?? 0,
        }
      }),
    }
  }
  if (completed.has("ondernemer")) {
    intake.ondernemer = {
      applicants: applicants.map((a) => ({
        businesses: businesses
          .filter((b) => b.applicantPosition === a.position)
          .map((b) => {
            const base = b.data as unknown as BusinessForm
            const ents = entities.filter((e) => e.businessId === b.id)
            const fins = financials.filter((f) => f.businessId === b.id)
            const out: BusinessForm = {
              ...base,
              guarantees: guarantees.filter((g) => g.businessId === b.id).map((g) => g.data as never),
            }
            if (base.soleProp) {
              out.soleProp = { ...base.soleProp, years: fins.filter((f) => f.entityKey === null).map((f) => f.data as never) }
            }
            if (base.bv) {
              out.bv = {
                ...base.bv,
                entities: ents.map((e) => ({
                  key: e.key,
                  name: (e.data as { name: string }).name,
                  role: e.role as "holding" | "werkmaatschappij",
                  parentKey: e.parentKey,
                  ownershipPct: e.ownershipPct ?? 100,
                  financials: fins.filter((f) => f.entityKey === e.key).map((f) => f.data as never),
                })),
                loansToDga: loans.filter((l) => l.businessId === b.id).map((l) => l.data as never),
              }
            }
            return out
          }),
      })),
    }
  }
  if (completed.has("verplichtingen")) {
    intake.verplichtingen = {
      obligations: obligations.map((o) => o.data as never),
      bkrRegistrations: general.bkrRegistrations,
    }
  }
  if (completed.has("vermogen") && assets[0]) intake.vermogen = assets[0].data as never
  if (completed.has("huidige-woning") && currents[0]) {
    intake["huidige-woning"] = {
      ...(currents[0].data as object),
      loanParts: loanParts.map((l) => l.data as never),
    } as never
  }
  if (completed.has("nieuwe-woning") && targets[0]) intake["nieuwe-woning"] = targets[0].data as never
  if (completed.has("voorkeuren") && general.preferences) intake.voorkeuren = general.preferences as never
  if (completed.has("risicos") && general.risks) intake.risicos = general.risks as never

  const drafts: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(general.drafts ?? {})) drafts[k] = v.data
  return { dossier, intake, drafts, skipped: general.skipped ?? [], completedSteps: dossier.completedSteps }
}

// ----------------------------------------------------------------------------- opslaan

export type SaveResult = { ok: true } | { ok: false; errors: string[] }

/** Sla een concept (nog niet valide) op, zodat de gebruiker later verder kan. */
export async function saveDraft(userId: string, dossierId: string, step: StepKey, data: unknown) {
  const dossier = await getOwnedDossier(userId, dossierId)
  const general = { ...((dossier.general ?? {}) as General) }
  general.drafts = { ...(general.drafts ?? {}), [step]: { at: new Date().toISOString(), data } }
  await getDb()
    .update(schema.dossiers)
    .set({ general, currentStep: step })
    .where(and(eq(schema.dossiers.id, dossierId), eq(schema.dossiers.userId, userId)))
}

export async function skipStep(userId: string, dossierId: string, step: StepKey) {
  const dossier = await getOwnedDossier(userId, dossierId)
  const general = { ...((dossier.general ?? {}) as General) }
  general.skipped = [...new Set([...(general.skipped ?? []), step])]
  await getDb()
    .update(schema.dossiers)
    .set({ general, status: "intake" })
    .where(and(eq(schema.dossiers.id, dossierId), eq(schema.dossiers.userId, userId)))
}

/** Valideer en sla een stap genormaliseerd op in de bijbehorende tabellen. */
export async function saveStep(userId: string, dossierId: string, step: Exclude<StepKey, "overzicht">, raw: unknown): Promise<SaveResult> {
  const schemaForStep = STEP_SCHEMAS[step]
  const parsed = schemaForStep.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }
  }
  const dossier = await getOwnedDossier(userId, dossierId)
  const db = getDb()
  const general = { ...((dossier.general ?? {}) as General) }
  if (general.drafts) {
    const { [step]: _omit, ...rest } = general.drafts
    general.drafts = rest
  }
  general.skipped = (general.skipped ?? []).filter((s) => s !== step)
  const base = { dossierId, userId }
  const queries: BatchItem<"pg">[] = []
  const del = (t: PgTable & Scoped) => db.delete(t).where(and(eq(t.dossierId, dossierId), eq(t.userId, userId)))

  const data = parsed.data as never
  let goal = dossier.goal
  let title = dossier.title
  switch (step) {
    case "doel": {
      const d = parsed.data as { goal: string; title?: string }
      goal = d.goal
      if (d.title) title = d.title
      break
    }
    case "persoonlijk": {
      const d = parsed.data as NonNullable<IntakeData["persoonlijk"]>
      general.household = { maritalStatus: d.maritalStatus, prenup: d.prenup, children: d.children, childrenUnder18: d.childrenUnder18 }
      const existing = await db.select().from(schema.applicants).where(and(eq(schema.applicants.dossierId, dossierId), eq(schema.applicants.userId, userId)))
      const count = d.hasPartner ? 2 : 1
      for (let i = 0; i < count; i++) {
        const prev = (existing.find((e) => e.position === i + 1)?.data ?? {}) as Record<string, unknown>
        const merged = { ...prev, ...d.applicants[i]! }
        queries.push(
          db
            .insert(schema.applicants)
            .values({ ...base, position: i + 1, data: merged })
            .onConflictDoUpdate({ target: [schema.applicants.dossierId, schema.applicants.position], set: { data: merged } })
        )
      }
      if (count === 1) {
        queries.push(db.delete(schema.applicants).where(and(eq(schema.applicants.dossierId, dossierId), eq(schema.applicants.position, 2))))
        queries.push(db.delete(schema.incomes).where(and(eq(schema.incomes.dossierId, dossierId), eq(schema.incomes.applicantPosition, 2))))
        queries.push(db.delete(schema.businesses).where(and(eq(schema.businesses.dossierId, dossierId), eq(schema.businesses.applicantPosition, 2))))
      }
      break
    }
    case "inkomen": {
      const d = parsed.data as NonNullable<IntakeData["inkomen"]>
      const existing = await db.select().from(schema.applicants).where(and(eq(schema.applicants.dossierId, dossierId), eq(schema.applicants.userId, userId)))
      queries.push(del(schema.incomes))
      d.applicants.forEach((a, i) => {
        const row = existing.find((e) => e.position === i + 1)
        if (row) {
          const merged = {
            ...(row.data as Record<string, unknown>),
            isEntrepreneur: a.isEntrepreneur,
            expectedRetirementIncome: a.expectedRetirementIncome ?? null,
            alimonyPaidAnnual: a.alimonyPaidAnnual,
          }
          queries.push(db.update(schema.applicants).set({ data: merged }).where(eq(schema.applicants.id, row.id)))
        }
        for (const income of a.incomes) {
          queries.push(db.insert(schema.incomes).values({ ...base, applicantPosition: i + 1, type: income.kind, data: income }))
        }
      })
      break
    }
    case "ondernemer": {
      const d = parsed.data as NonNullable<IntakeData["ondernemer"]>
      queries.push(del(schema.businesses))
      for (const [i, a] of d.applicants.entries()) {
        for (const b of a.businesses) {
          const { guarantees, ...rest } = b
          const stored: Record<string, unknown> = { ...rest }
          if (rest.soleProp) stored.soleProp = { ...rest.soleProp, years: [] }
          if (rest.bv) stored.bv = { ...rest.bv, entities: [], loansToDga: [] }
          const businessId = randomUUID()
          queries.push(
            db.insert(schema.businesses).values({ id: businessId, ...base, applicantPosition: i + 1, legalForm: b.legalForm, data: stored })
          )
          for (const g of guarantees) queries.push(db.insert(schema.businessGuarantees).values({ ...base, businessId, data: g }))
          for (const y of b.soleProp?.years ?? []) {
            queries.push(db.insert(schema.businessFinancials).values({ ...base, businessId, entityKey: null, year: y.year, data: y }))
          }
          for (const e of b.bv?.entities ?? []) {
            queries.push(
              db.insert(schema.businessEntities).values({
                ...base,
                businessId,
                role: e.role,
                key: e.key,
                parentKey: e.parentKey,
                ownershipPct: e.ownershipPct,
                data: { name: e.name },
              })
            )
            for (const f of e.financials) {
              queries.push(db.insert(schema.businessFinancials).values({ ...base, businessId, entityKey: e.key, year: f.year, data: f }))
            }
            if (e.parentKey === null && b.bv) {
              queries.push(
                db.insert(schema.shareholdings).values({ ...base, businessId, applicantPosition: i + 1, entityKey: e.key, pct: b.bv.shareholdingPct, direct: true })
              )
            }
          }
          for (const l of b.bv?.loansToDga ?? []) queries.push(db.insert(schema.dgaLoans).values({ ...base, businessId, data: l }))
        }
      }
      break
    }
    case "verplichtingen": {
      const d = parsed.data as NonNullable<IntakeData["verplichtingen"]>
      general.bkrRegistrations = d.bkrRegistrations
      queries.push(del(schema.obligations))
      for (const o of d.obligations) {
        queries.push(db.insert(schema.obligations).values({ ...base, applicantPosition: o.applicantPosition, type: o.type, data: o }))
      }
      break
    }
    case "vermogen":
      queries.push(del(schema.assets))
      queries.push(db.insert(schema.assets).values({ ...base, type: "assets", data }))
      break
    case "huidige-woning": {
      const d = parsed.data as NonNullable<IntakeData["huidige-woning"]>
      const { loanParts, ...rest } = d
      const currentPropertyId = randomUUID()
      queries.push(del(schema.currentProperties))
      queries.push(db.insert(schema.currentProperties).values({ id: currentPropertyId, ...base, data: rest }))
      loanParts.forEach((lp, position) =>
        queries.push(db.insert(schema.currentLoanParts).values({ ...base, currentPropertyId, position, data: lp }))
      )
      break
    }
    case "nieuwe-woning":
      queries.push(del(schema.targetProperties))
      queries.push(db.insert(schema.targetProperties).values({ ...base, data }))
      break
    case "voorkeuren":
      general.preferences = data
      break
    case "risicos":
      general.risks = data
      break
  }
  const completed = [...new Set([...dossier.completedSteps, step])]
  queries.push(
    db
      .update(schema.dossiers)
      .set({ goal, title, general, completedSteps: completed })
      .where(and(eq(schema.dossiers.id, dossierId), eq(schema.dossiers.userId, userId)))
  )
  await runBatch(queries)
  return { ok: true }
}

export async function setDossierStatus(userId: string, dossierId: string, status: string) {
  await getDb()
    .update(schema.dossiers)
    .set({ status })
    .where(and(eq(schema.dossiers.id, dossierId), eq(schema.dossiers.userId, userId)))
}
