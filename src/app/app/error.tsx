"use client"

import { Button } from "@/components/ui/button"

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-6">
      <h1 className="text-lg font-semibold">Er ging iets mis</h1>
      <p className="text-sm text-muted-foreground">
        We konden deze pagina niet laden. Je gegevens zijn veilig opgeslagen. Probeer het opnieuw; blijft het misgaan, kom dan later terug.
      </p>
      <Button onClick={reset}>Opnieuw proberen</Button>
    </div>
  )
}
