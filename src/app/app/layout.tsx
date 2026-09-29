import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { isAdmin, requireUserIdOrRedirect } from "@/lib/auth"

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireUserIdOrRedirect()
  const admin = await isAdmin()
  return (
    <>
      <SiteHeader showAdmin={admin} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}
