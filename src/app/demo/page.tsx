import { Disclaimer } from "@/components/disclaimer"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { ButtonLink } from "@/components/ui/button-link"
import { DemoPicker } from "@/components/what-if/demo-picker"
import { DEMO_PROFILES } from "@/lib/demo/profiles"
import { SEED_LENDERS, SEED_RATES } from "@/lib/lenders"
import { seedNormSet } from "@/lib/norms"

export const metadata = { title: "Voorbeelden" }

export default function DemoPage() {
  const ctx = { norms: seedNormSet(), lenders: SEED_LENDERS, rates: SEED_RATES.filter((r) => r.fixedYears === 10) }
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-2xl font-semibold">Voorbeelden</h1>
          <p className="text-muted-foreground">
            Bekijk fictieve voorbeelden en schuif met de knoppen. Dezelfde rekenkern en normen als in je eigen dossier; alles wordt in je browser berekend.
          </p>
        </div>
        <DemoPicker profiles={DEMO_PROFILES} ctx={ctx} />
        <ButtonLink href="/app" size="lg">
          Start je eigen hypotheekcheck
        </ButtonLink>
        <Disclaimer />
      </main>
      <SiteFooter />
    </>
  )
}
