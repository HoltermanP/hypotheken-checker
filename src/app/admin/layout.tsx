import Link from "next/link"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { isAdmin, requireUserIdOrRedirect } from "@/lib/auth"

export const metadata = { title: "Beheer" }

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireUserIdOrRedirect()
  const admin = await isAdmin()
  return (
    <>
      <SiteHeader showAdmin={admin} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {admin ? (
          <>
            <nav aria-label="Beheer" className="mb-6 flex flex-wrap gap-4 border-b pb-3 text-sm">
              <Link href="/admin" className="hover:underline">Overzicht</Link>
              <Link href="/admin/normen" className="hover:underline">Normen</Link>
              <Link href="/admin/geldverstrekkers" className="hover:underline">Geldverstrekkers en rentes</Link>
            </nav>
            {children}
          </>
        ) : (
          <div role="alert" className="rounded-lg border p-6">
            <h1 className="text-xl font-semibold">Geen toegang</h1>
            <p className="mt-2 text-muted-foreground">
              Deze pagina is alleen voor beheerders. Een beheerder krijgt toegang via de Clerk-instelling
              <code className="mx-1">publicMetadata.role = &quot;admin&quot;</code>.
            </p>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
