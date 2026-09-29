import { formatEuro, formatPct } from "@/lib/format"
import type { AdviceFacts } from "./facts"

/**
 * Vaste teksten (terugvaloptie als de AI-tekst niet beschikbaar is of de getallencheck faalt).
 * Alle getallen komen rechtstreeks uit de feiten.
 */

export interface AdviceTexts {
  samenvatting: string
  maximaleHypotheek: string
  financiering: string
  bankadvies: string
  risico: string
  ondernemer: string | null
  overwaarde: string | null
}

export function templateTexts(f: AdviceFacts): AdviceTexts {
  const stressRed = f.stresstests.filter((s) => s.stoplicht === "red").map((s) => s.test)
  return {
    samenvatting:
      `Je doel is ${f.doel}. Op basis van je inkomen en de woning kun je maximaal ${formatEuro(f.maximaleHypotheek)} lenen. ` +
      `Verstandig lenen, met ruimte om te sparen, komt uit op ${formatEuro(f.verstandigLenen)}. ` +
      (f.hypotheekbedrag > 0
        ? `Voor een hypotheek van ${formatEuro(f.hypotheekbedrag)} betaal je ongeveer ${formatEuro(f.brutoMaandlast)} bruto en ${formatEuro(f.nettoMaandlast)} netto per maand (rente ${formatPct(f.rentePct)}, ${f.rentevastJaren} jaar vast${f.nhg ? ", met NHG" : ""}).`
        : "Er is geen nieuwe hypotheek nodig."),
    maximaleHypotheek:
      `Op basis van je toetsinkomen van ${formatEuro(f.toetsinkomen)} en een toetsrente van ${formatPct(f.toetsrentePct)} mag je maximaal ${formatEuro(f.maximaleHypotheekInkomen)} lenen. ` +
      (f.maximaleHypotheekOnderpand !== null ? `Op basis van de woningwaarde is dat ${formatEuro(f.maximaleHypotheekOnderpand)}. ` : "") +
      `De beperkende factor is je ${f.beperkendeFactor}.` +
      (f.aowToetsBepalend ? " Je inkomen na de AOW-leeftijd bepaalt de leenruimte." : "") +
      (f.knoppen.length > 0 ? ` Je leenruimte kan groter worden door: ${f.knoppen.map((k) => `${k.knop.toLowerCase()} (${formatEuro(k.extraLeenruimte)} extra)`).join(", ")}.` : ""),
    financiering:
      (f.kostenKoper !== null ? `De kosten koper zijn ${formatEuro(f.kostenKoper)}, waarvan ${formatEuro(f.overdrachtsbelasting ?? 0)} overdrachtsbelasting${f.startersvrijstelling ? " (je krijgt de startersvrijstelling)" : ""}. ` : "") +
      (f.overwaarde !== null ? `De overwaarde van je huidige woning is ${formatEuro(f.overwaarde)}. ` : "") +
      (f.tekortEigenGeld > 0 ? `Je komt ${formatEuro(f.tekortEigenGeld)} eigen geld tekort.` : "De financiering is rond."),
    bankadvies:
      f.top3.length > 0
        ? `Bij ${f.aantalBankenMogelijk} geldverstrekkers is deze hypotheek mogelijk. De voordeligste over de rentevaste periode: ${f.top3.map((t) => `${t.bank} (${formatPct(t.rentePct)}, ${formatEuro(t.nettoMaandlast)} netto per maand)`).join(", ")}.`
        : "Geen geldverstrekker accepteert dit profiel met dit leenbedrag. Bekijk de redenen per bank.",
    risico:
      stressRed.length > 0
        ? `Let op bij: ${stressRed.join(", ")}. Bekijk de tips in de risicoanalyse.`
        : "In de stresstests zijn geen rode signalen. Houd wel een buffer aan voor tegenvallers.",
    ondernemer:
      f.ondernemers && f.ondernemers.length > 0
        ? f.ondernemers
            .map((o) => `Voor je ${o.rechtsvorm} rekenen banken met een toetsinkomen tussen ${formatEuro(o.toetsinkomenLaagste)} en ${formatEuro(o.toetsinkomenHoogste)}. Het continuïteitsrisico is ${o.risiconiveau}.`)
            .join(" ")
        : null,
    overwaarde:
      f.overwaardeOpties && f.overwaardeOpties.length > 0
        ? `Je hebt ${f.overwaardeOpties.length} mogelijkheden om je overwaarde te benutten. Vergelijk de netto-effecten en de risico's per optie.`
        : null,
  }
}
