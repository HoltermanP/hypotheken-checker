import { Sparkles } from "lucide-react"
import type { AdviceTexts } from "@/lib/advice/template"
import type { StoredReport } from "@/lib/services/report"

/** Toont één AI- of templatetekst met herkomst. */
export function AdviceText({ report, section }: { report: StoredReport; section: keyof AdviceTexts }) {
  const text = report.texts[section]
  if (!text) return null
  return (
    <div className="space-y-1 rounded-xl bg-muted/50 p-4 text-sm leading-relaxed">
      <p>{text}</p>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Sparkles aria-hidden className="size-3" />
        {report.source === "llm"
          ? "Toelichting geschreven met AI op basis van de berekening; alle getallen zijn automatisch gecontroleerd."
          : "Standaardtoelichting op basis van de berekening."}
      </p>
    </div>
  )
}
