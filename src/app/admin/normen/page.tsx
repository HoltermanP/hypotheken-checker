import Link from "next/link"
import { desc } from "drizzle-orm"
import { ActionForm } from "@/components/admin/action-form"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getDb, schema } from "@/lib/db/client"
import { formatDate } from "@/lib/format"
import { activateNormSet, cloneNormSet } from "../actions"

export const dynamic = "force-dynamic"

export default async function NormSetsPage() {
  let sets: (typeof schema.normSets.$inferSelect)[] = []
  let error: string | null = null
  try {
    sets = await getDb().select().from(schema.normSets).orderBy(desc(schema.normSets.year), desc(schema.normSets.version))
  } catch (e) {
    error = (e as Error).message
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Normensets</h1>
      {error ? (
        <p role="alert" className="text-destructive">Database niet bereikbaar: {error}. Draai eerst pnpm db:migrate en pnpm db:seed.</p>
      ) : sets.length === 0 ? (
        <p className="text-muted-foreground">Nog geen normensets. Draai pnpm db:seed.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jaar</TableHead>
                <TableHead>Versie</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aangemaakt</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sets.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/admin/normen/${s.id}`} className="font-medium underline">{s.year}</Link>
                  </TableCell>
                  <TableCell>{s.version}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "outline"}>
                      {s.status === "active" ? "actief" : s.status === "draft" ? "concept" : "gearchiveerd"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(s.createdAt)}</TableCell>
                  <TableCell className="space-y-2">
                    {s.status !== "active" ? (
                      <ActionForm action={activateNormSet} submitLabel="Activeren" variant="outline">
                        <input type="hidden" name="setId" value={s.id} />
                      </ActionForm>
                    ) : null}
                    <ActionForm action={cloneNormSet} submitLabel="Klonen naar jaar" variant="secondary" className="flex items-end gap-2 space-y-0">
                      <input type="hidden" name="setId" value={s.id} />
                      <div>
                        <Label htmlFor={`year-${s.id}`} className="sr-only">Nieuw jaar</Label>
                        <Input id={`year-${s.id}`} name="year" type="number" defaultValue={s.year + 1} className="w-24" />
                      </div>
                    </ActionForm>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
