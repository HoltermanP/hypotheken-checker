import { StaticPage } from "@/components/layout/static-page"

export const metadata = { title: "Cookies" }

export default function CookiesPage() {
  return (
    <StaticPage title="Cookies">
      <p>HypotheekCheck NL gebruikt alleen functionele cookies. Daarvoor is geen toestemming nodig.</p>
      <ul>
        <li>Inlogcookies van Clerk (bijvoorbeeld <code>__session</code>) om je ingelogd te houden en je sessie te beveiligen.</li>
        <li>Technische cookies die nodig zijn om formulieren veilig te versturen.</li>
      </ul>
      <p>We gebruiken geen analytische, advertentie- of trackingcookies en delen geen gegevens met advertentienetwerken.</p>
    </StaticPage>
  )
}
