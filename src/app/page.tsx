import {
  Building2,
  Calculator,
  FileCheck2,
  Landmark,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { ButtonLink } from "@/components/ui/button-link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Disclaimer } from "@/components/disclaimer"

const features = [
  {
    icon: Calculator,
    title: "Rekenen volgens de norm",
    text: "Maximale hypotheek volgens de Tijdelijke regeling hypothecair krediet en de Nibud-financieringslasttabellen. Elk getal is herleidbaar naar een berekening en een bron.",
  },
  {
    icon: Landmark,
    title: "Vergelijking van geldverstrekkers",
    text: "Acceptatie, leenruimte, netto maandlast en totale kosten per bank, met een onderbouwde top 3.",
  },
  {
    icon: Building2,
    title: "Ook voor ondernemers",
    text: "Eenmanszaak, vof, DGA met BV of holding: toetsinkomen per bank, uitkeerbare winst en ondernemersscenario's.",
  },
  {
    icon: FileCheck2,
    title: "Documenten automatisch uitgelezen",
    text: "Upload je werkgeversverklaring, salarisstrook of jaarcijfers. Jij controleert en bevestigt; wij checken de consistentie.",
  },
  {
    icon: TrendingUp,
    title: "Scenario's en stresstests",
    text: "Rentestijging, werkloosheid, arbeidsongeschiktheid, overlijden, pensioen, scheiding en waardedaling van je woning.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy voorop",
    text: "Versleutelde opslag, geen BSN, automatische verwijdering van documenten en volledige export of verwijdering van je gegevens.",
  },
]

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-20">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Weet wat je kunt en wat verstandig is om te lenen
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              HypotheekCheck NL berekent je maximale hypotheek, vergelijkt meer dan vijftien
              geldverstrekkers en laat zien wat er gebeurt als het tegenzit. Voor starters,
              doorstromers, oversluiters, overwaarde en ondernemers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink size="lg" href="/app">
                Start je hypotheekcheck
              </ButtonLink>
              <ButtonLink size="lg" variant="outline" href="/demo">
                Bekijk een voorbeeld
              </ButtonLink>
            </div>
          </div>
        </section>
        <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 pb-16">
          <h2 id="features" className="sr-only">
            Wat je krijgt
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <f.icon aria-hidden className="size-6 text-primary" />
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{f.text}</CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-10">
            <Disclaimer />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
