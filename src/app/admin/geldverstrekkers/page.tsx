import Link from "next/link"
import { StatusBadge } from "@/components/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import { getLenders, getRates } from "@/lib/services/reference-data"

export const dynamic = "force-dynamic"

export default async function LendersAdminPage() {
  const [lenders, rates] = await Promise.all([getLenders(), getRates()])
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Geldverstrekkers en rentes</h1>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Geldverstrekker</TableHead>
              <TableHead>Actief</TableHead>
              <TableHead>Criteria geverifieerd</TableHead>
              <TableHead>Rentes</TableHead>
              <TableHead>Rente van</TableHead>
              <TableHead>Status rente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lenders.map((l) => {
              const own = rates.filter((r) => r.lenderSlug === l.slug)
              const latest = own.reduce<string | null>((m, r) => (!m || r.rateDate > m ? r.rateDate : m), null)
              const statuses = Object.values(l.sources)
              const verified = statuses.filter((s) => s.status === "verified").length
              return (
                <TableRow key={l.slug}>
                  <TableCell>
                    <Link href={`/admin/geldverstrekkers/${l.slug}`} className="font-medium underline">{l.name}</Link>
                  </TableCell>
                  <TableCell>{l.active ? "ja" : "nee"}</TableCell>
                  <TableCell>{verified} / {statuses.length}</TableCell>
                  <TableCell>{own.length}</TableCell>
                  <TableCell>{latest ? formatDate(latest) : "–"}</TableCell>
                  <TableCell>{own[0] ? <StatusBadge status={own[0].status} /> : "–"}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
