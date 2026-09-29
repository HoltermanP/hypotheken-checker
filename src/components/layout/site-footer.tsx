import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          HypotheekCheck NL geeft een indicatie en geen financieel advies in de zin van de Wft.
        </p>
        <nav aria-label="Voettekst" className="flex gap-4">
          <Link href="/privacy" className="hover:underline">
            Privacyverklaring
          </Link>
          <Link href="/cookies" className="hover:underline">
            Cookies
          </Link>
          <Link href="/disclaimer" className="hover:underline">
            Disclaimer
          </Link>
        </nav>
      </div>
    </footer>
  )
}
