import { StaticPage } from "@/components/layout/static-page"

export const metadata = { title: "Privacyverklaring" }

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacyverklaring">
      <p>HypotheekCheck NL verwerkt persoonsgegevens om je een indicatief hypotheekadvies te geven. In deze verklaring lees je welke gegevens we verwerken, waarom, en welke rechten je hebt onder de Algemene verordening gegevensbescherming (AVG).</p>
      <h2>Welke gegevens</h2>
      <ul>
        <li>Accountgegevens (e-mailadres) via onze inlogdienst Clerk.</li>
        <li>Intakegegevens: geboortedatum, huishouden, inkomen, verplichtingen, vermogen, woning en voorkeuren.</li>
        <li>Documenten die je uploadt en de gegevens die daaruit worden uitgelezen, pas na jouw bevestiging overgenomen.</li>
        <li>Berekeningen, rapportteksten, scenario&apos;s en chatberichten.</li>
        <li>Een audit-log van acties (zonder inhoud of persoonsgegevens).</li>
      </ul>
      <p>We slaan nooit een burgerservicenummer (BSN) op in onze database. Uitgelezen gegevens worden gecontroleerd op BSN&apos;s en die worden verwijderd.</p>
      <h2>Waarom (grondslag)</h2>
      <p>We verwerken je gegevens om de dienst uit te voeren die je vraagt (uitvoering van een overeenkomst, art. 6 lid 1 sub b AVG). Financiële gegevens gebruiken we uitsluitend voor jouw berekening.</p>
      <h2>Beveiliging</h2>
      <ul>
        <li>Persoons- en financiële gegevens worden op applicatieniveau versleuteld (AES-256-GCM) opgeslagen.</li>
        <li>Documenten staan in privé-opslag en zijn alleen via kortlevende, ondertekende links voor jou te openen.</li>
        <li>Alle toegang wordt gecontroleerd op je account; we loggen wie wat heeft bekeken.</li>
      </ul>
      <h2>Verwerkers</h2>
      <ul>
        <li>Vercel (hosting en documentopslag), Neon (database), Clerk (inloggen).</li>
        <li>Anthropic (Claude): voor het uitlezen van documenten en het schrijven van toelichtingen. Alleen de benodigde gegevens worden verstuurd.</li>
      </ul>
      <h2>Bewaartermijnen</h2>
      <p>Documenten worden automatisch verwijderd na de bewaartermijn (standaard 90 dagen). Dossiers blijven bewaard tot je ze verwijdert. De audit-log bewaren we maximaal 2 jaar, geanonimiseerd na verwijdering van je account.</p>
      <h2>Je rechten</h2>
      <ul>
        <li>Inzage en overdraagbaarheid: download al je gegevens via Account en privacy.</li>
        <li>Verwijdering: verwijder een dossier of je hele account direct zelf.</li>
        <li>Correctie: pas je gegevens aan in de intake.</li>
        <li>Je kunt een klacht indienen bij de Autoriteit Persoonsgegevens.</li>
      </ul>
    </StaticPage>
  )
}
