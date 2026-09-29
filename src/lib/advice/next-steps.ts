import type { EngineInput } from "@/lib/engine/types"

/**
 * Checklist en tijdlijn met vervolgstappen per doel. Datums alleen als ze bekend zijn uit de
 * intake of bevestigde documenten; verder een volgorde.
 */

export interface NextStep {
  title: string
  detail: string
  date?: string | null
}

export function nextSteps(input: EngineInput, opts: { financingDeadline?: string | null; guaranteePct: number }): NextStep[] {
  const t = input.targetProperty
  const steps: NextStep[] = []
  if (input.goal === "starter" || input.goal === "doorstromer" || (input.goal === "orientatie" && t)) {
    steps.push({ title: "Bezichtigen en bieden", detail: "Laat je adviseur meekijken met het bod. Zorg dat je leenruimte vooraf duidelijk is." })
    steps.push({
      title: "Koopovereenkomst met ontbindende voorwaarden",
      detail: "Neem een financieringsvoorbehoud op (en eventueel een voorbehoud voor NHG en bouwkundige keuring). Je hebt wettelijke bedenktijd na ondertekening.",
    })
    if (t?.kind !== "new_build") steps.push({ title: "Taxatie", detail: "Laat een gevalideerd taxatierapport opmaken; de bank baseert de maximale hypotheek op de marktwaarde." })
    if (t?.useBuildingInspection) steps.push({ title: "Bouwkundige keuring", detail: "Laat de staat van de woning onderzoeken voordat de ontbindende voorwaarden verlopen." })
    steps.push({
      title: "Bankgarantie of waarborgsom",
      detail: `Meestal ${opts.guaranteePct}% van de koopsom, te regelen binnen de termijn uit de koopovereenkomst.`,
    })
    steps.push({
      title: "Hypotheekaanvraag en bindend aanbod",
      detail: "Vraag de hypotheek aan bij de gekozen geldverstrekker en onderteken het aanbod vóór de datum van het financieringsvoorbehoud.",
      date: opts.financingDeadline ?? null,
    })
    if (input.goal === "doorstromer") {
      steps.push({
        title: input.move?.order === "buy_first" ? "Overbruggingskrediet" : "Verkoop huidige woning",
        detail: input.move?.order === "buy_first" ? "Regel het overbruggingskrediet samen met de nieuwe hypotheek." : "Verkoop je huidige woning en plan de levering zo dat je tijdelijk wonen beperkt.",
      })
    }
    steps.push({ title: "Notaris", detail: "De notaris maakt de leveringsakte en hypotheekakte en stuurt vooraf de nota van afrekening." })
    steps.push({ title: "Sleuteloverdracht", detail: "Na ondertekening bij de notaris ben je eigenaar.", date: t?.deliveryDate ?? null })
  } else if (input.goal === "oversluiten") {
    steps.push({ title: "Boeterente opvragen", detail: "Vraag bij je huidige bank de exacte boeterente en de mogelijkheden voor rentemiddeling op." })
    steps.push({ title: "Offerte aanvragen", detail: "Vraag offertes aan bij de banken uit de top 3 en vergelijk de totale kosten over de rentevaste periode." })
    steps.push({ title: "Taxatie (indien nodig)", detail: "Een nieuwe taxatie kan een lagere LTV-klasse en dus een lagere rente opleveren." })
    steps.push({ title: "Notaris", detail: "Bij overstap naar een andere bank is een nieuwe hypotheekakte nodig." })
  } else if (input.goal === "verhogen") {
    steps.push({ title: "Offerte en taxatie", detail: "Laat de woning taxeren en vraag een offerte voor de verhoging aan." })
    steps.push({ title: "Bouwdepot", detail: "Bij een verbouwing of verduurzaming wordt het geld via een bouwdepot uitbetaald op basis van facturen." })
    steps.push({ title: "Notaris", detail: "Voor een verhoging boven de bestaande inschrijving is een notariële akte nodig." })
  } else if (input.goal === "verkopen") {
    steps.push({ title: "Makelaar en verkoop", detail: "Kies een makelaar en laat de verkoopprijs onderbouwen." })
    steps.push({ title: "Aflossen en royement", detail: "Bij de levering lost de notaris de hypotheek af uit de opbrengst; vraag boetevrije aflossing bij verkoop na." })
    steps.push({ title: "Eigenwoningreserve", detail: "Koop je binnen 3 jaar een nieuwe woning, dan moet je de overwaarde daarin inbrengen voor maximale renteaftrek." })
  } else {
    steps.push({ title: "Leenruimte laten bevestigen", detail: "Laat je maximale hypotheek vooraf bevestigen door een erkend adviseur." })
  }
  steps.push({ title: "Advies bij een erkend adviseur", detail: "Deze uitkomst is indicatief. Laat je voor een aanvraag adviseren door een adviseur met AFM-vergunning." })
  return steps
}
