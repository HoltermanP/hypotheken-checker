import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DISCLAIMER_TEXT } from "./disclaimer-text"

export { DISCLAIMER_TEXT }

export function Disclaimer({ className }: { className?: string }) {
  return (
    <Alert className={className} data-testid="disclaimer">
      <AlertTriangle aria-hidden />
      <AlertTitle>Disclaimer</AlertTitle>
      <AlertDescription>{DISCLAIMER_TEXT}</AlertDescription>
    </Alert>
  )
}
