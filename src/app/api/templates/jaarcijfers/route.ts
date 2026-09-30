import { buildTemplate } from "@/lib/documents/financials-xlsx"

/** Excel-sjabloon voor jaarcijfers (geen persoonsgegevens; openbaar). */
export function GET() {
  const last = new Date().getFullYear() - 1
  const data = buildTemplate([last - 2, last - 1, last])
  return new Response(data, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="jaarcijfers-sjabloon.xlsx"',
      "Cache-Control": "public, max-age=3600",
    },
  })
}
