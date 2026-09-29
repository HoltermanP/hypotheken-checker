import Link from "next/link"
import { FolderOpen, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Disclaimer } from "@/components/disclaimer"
import { requireUserIdOrRedirect } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { listDossiers } from "@/lib/services/dossiers"
import { GOAL_OPTIONS } from "@/lib/intake/goals"
import { createDossierAction } from "./actions"

export const metadata = { title: "Mijn dossiers" }

const STATUS: Record<string, string> = { intake: "Intake", ready: "Klaar om te berekenen", advice: "Advies beschikbaar" }

export default async function DossiersPage() {
  const userId = await requireUserIdOrRedirect()
  let dossiers: Awaited<ReturnType<typeof listDossiers>> = []
  let error = false
  try {
    dossiers = await listDossiers(userId)
  } catch {
    error = true
  }
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mijn dossiers</h1>
          <p className="text-sm text-muted-foreground">Je voortgang wordt automatisch opgeslagen. Je kunt altijd later verder.</p>
        </div>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
          We kunnen je dossiers nu niet laden. Probeer het over een paar minuten opnieuw.
        </p>
      ) : dossiers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <FolderOpen aria-hidden className="size-8 text-muted-foreground" />
          <p className="font-medium">Nog geen dossiers</p>
          <p className="text-sm text-muted-foreground">Kies hieronder wat je wilt doen om te beginnen.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {dossiers.map((d) => (
            <li key={d.id}>
              <Link href={`/app/dossiers/${d.id}`} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50">
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardHeader>
                    <CardTitle className="text-base">{d.title}</CardTitle>
                    <CardDescription>Laatst bijgewerkt {formatDate(d.updatedAt)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">{STATUS[d.status] ?? d.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="nieuw" className="space-y-3">
        <h2 id="nieuw" className="text-lg font-semibold">Nieuw dossier</h2>
        <form action={createDossierAction} className="grid gap-3 sm:grid-cols-2">
          {GOAL_OPTIONS.map((o) => (
            <Button key={o.value} type="submit" name="goal" value={o.value} variant="outline" className="h-auto flex-col items-start gap-1 p-4 text-left whitespace-normal">
              <span className="flex items-center gap-2 font-medium">
                <Plus aria-hidden /> {o.label}
              </span>
              <span className="text-xs font-normal text-muted-foreground">{o.text}</span>
            </Button>
          ))}
        </form>
      </section>
      <Disclaimer />
    </div>
  )
}
