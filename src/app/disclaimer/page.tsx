import { StaticPage } from "@/components/layout/static-page"
import { DISCLAIMER_TEXT } from "@/components/disclaimer-text"

export const metadata = { title: "Disclaimer" }

export default function DisclaimerPage() {
  return (
    <StaticPage title="Disclaimer">
      <p className="font-medium">{DISCLAIMER_TEXT}</p>
      <p>
        De berekeningen volgen de Tijdelijke regeling hypothecair krediet, de Nibud-financieringslastnormen, de voorwaarden van de Nationale Hypotheek Garantie en de fiscale regels voor de eigen woning, zoals wij die hebben vastgelegd met bron en datum. Rentes en acceptatiecriteria van geldverstrekkers komen uit openbare bronnen en kunnen verouderd zijn; de datum staat bij elke rente.
      </p>
      <p>Parameters die we nog niet bij de primaire bron hebben kunnen verifiëren, zijn in het rapport gemarkeerd als &quot;te verifiëren&quot;.</p>
    </StaticPage>
  )
}
