import Link from "next/link"
import { Home } from "lucide-react"
import { isE2ETestMode } from "@/env"
import { UserMenu } from "./user-menu"

export function SiteHeader({ showAdmin = false }: { showAdmin?: boolean }) {
  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Home aria-hidden className="size-5 text-primary" />
          <span>HypotheekCheck NL</span>
        </Link>
        <nav aria-label="Hoofdnavigatie" className="flex items-center gap-4 text-sm">
          <Link href="/app" className="hover:underline">
            Mijn dossiers
          </Link>
          <Link href="/demo" className="hidden hover:underline sm:inline">
            Voorbeelden
          </Link>
          <Link href="/app/account" className="hidden hover:underline sm:inline">
            Account
          </Link>
          {showAdmin ? (
            <Link href="/admin" className="hover:underline">
              Beheer
            </Link>
          ) : null}
          {isE2ETestMode() ? (
            <span className="text-xs text-muted-foreground">testmodus</span>
          ) : (
            <UserMenu />
          )}
        </nav>
      </div>
    </header>
  )
}
