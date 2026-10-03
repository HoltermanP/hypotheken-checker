import Link from "next/link"
import { notFound } from "next/navigation"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { audit } from "@/lib/services/audit"
import { getOwnedDossier, NotFoundError } from "@/lib/services/dossiers"
import { deleteDossierAction } from "@/app/app/account/actions"
import { Button } from "@/components/ui/button"

export default async function DossierLayout({ children, params }: LayoutProps<"/app/dossiers/[id]">) {
  const { id } = await params
  const userId = await requireUserIdOrRedirect()
  let dossier
  try {
    dossier = await getOwnedDossier(userId, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  await audit({ userId, action: "view", entityType: "dossier", entityId: id, dossierId: id })
  const tabs = [
    { href: `/app/dossiers/${id}/start`, label: "Start" },
    { href: `/app/dossiers/${id}/advies`, label: "Advies" },
    { href: `/app/dossiers/${id}/wat-als`, label: "Wat als" },
    { href: `/app/dossiers/${id}/chat`, label: "Vraag het" },
  ]
  return (
    <div className="space-y-6">
      <div>
        <Link href="/app" className="text-sm text-muted-foreground hover:underline">
          ← Mijn dossiers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{dossier.title}</h1>
      </div>
      <nav aria-label="Dossier" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b">
          {tabs.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="inline-block border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap hover:border-muted-foreground">
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
      <details className="rounded-xl border border-destructive/30 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Dossier verwijderen</summary>
        <form action={deleteDossierAction} className="mt-3 space-y-2">
          <input type="hidden" name="dossierId" value={id} />
          <p className="text-muted-foreground">Dit verwijdert direct het dossier, alle documenten (ook de bestanden), berekeningen en chats.</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="confirm" required /> Ik begrijp dat dit niet ongedaan kan worden gemaakt
          </label>
          <Button type="submit" variant="destructive" size="sm">
            Dossier definitief verwijderen
          </Button>
        </form>
      </details>
    </div>
  )
}
