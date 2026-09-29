import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export const DISCLAIMER_TEXT =
  "Dit is een indicatie en geen financieel advies in de zin van de Wet op het financieel toezicht (Wft). Raadpleeg voor een definitieve aanvraag een erkend hypotheekadviseur met een AFM-vergunning. Aan de uitkomsten kunnen geen rechten worden ontleend."

export function Disclaimer({ className }: { className?: string }) {
  return (
    <Alert className={className} data-testid="disclaimer">
      <AlertTriangle aria-hidden />
      <AlertTitle>Disclaimer</AlertTitle>
      <AlertDescription>{DISCLAIMER_TEXT}</AlertDescription>
    </Alert>
  )
}
