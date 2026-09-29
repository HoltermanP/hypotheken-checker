import { Badge } from "@/components/ui/badge"

/** Verificatiestatus van een norm, criterium of rente. */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (status === "verified") return <Badge variant="secondary">geverifieerd</Badge>
  if (status === "derived") return <Badge variant="outline">afgeleid</Badge>
  if (status === "unknown") return <Badge variant="outline">onbekend</Badge>
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-800 dark:text-amber-300">
      te verifiëren
    </Badge>
  )
}
