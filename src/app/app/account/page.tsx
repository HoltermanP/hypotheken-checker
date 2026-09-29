import { Download, Trash2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { deleteAccountAction } from "./actions"

export const metadata = { title: "Account en privacy" }

export default async function AccountPage({ searchParams }: PageProps<"/app/account">) {
  await requireUserIdOrRedirect()
  const { fout } = await searchParams
  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Account en privacy</h1>
      <section aria-labelledby="export" className="space-y-2">
        <h2 id="export" className="text-lg font-semibold">Je gegevens downloaden</h2>
        <p className="text-sm text-muted-foreground">
          Download alles wat we van je hebben opgeslagen (intake, uitgelezen documentgegevens, berekeningen, rapportteksten en chat) als JSON-bestand. Dit is je recht op inzage en overdraagbaarheid (AVG art. 15 en 20).
        </p>
        <a href="/api/account/export" className={buttonVariants({ variant: "outline" })}>
          <Download aria-hidden /> Download mijn gegevens
        </a>
      </section>
      <section aria-labelledby="verwijder" className="space-y-3 rounded-xl border border-destructive/40 p-4">
        <h2 id="verwijder" className="text-lg font-semibold">Account en alle gegevens verwijderen</h2>
        <p className="text-sm text-muted-foreground">
          We verwijderen direct al je dossiers, documenten (ook de bestanden), berekeningen en chats, en je account. Dit kan niet ongedaan worden gemaakt (AVG art. 17).
        </p>
        <form action={deleteAccountAction} className="space-y-2">
          <Label htmlFor="confirmText">Typ VERWIJDEREN om te bevestigen</Label>
          <Input id="confirmText" name="confirmText" autoComplete="off" aria-invalid={fout === "bevestiging" || undefined} aria-describedby={fout ? "confirm-error" : undefined} />
          {fout === "bevestiging" ? (
            <p id="confirm-error" role="alert" className="text-sm text-destructive">
              Typ precies VERWIJDEREN om te bevestigen.
            </p>
          ) : null}
          <Button type="submit" variant="destructive">
            <Trash2 aria-hidden /> Alles definitief verwijderen
          </Button>
        </form>
      </section>
    </div>
  )
}
