import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { nlNL } from "@clerk/localizations"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { isE2ETestMode } from "@/env"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "HypotheekCheck NL", template: "%s · HypotheekCheck NL" },
  description:
    "Onderbouwd, indicatief hypotheekadvies op basis van de actuele normen (Trhk, Nibud, NHG en fiscale regels).",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const body = (
    <html lang="nl" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a href="#main" className="skip-link rounded bg-primary px-3 py-2 text-primary-foreground">
          Naar de inhoud
        </a>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
  if (isE2ETestMode()) return body
  return <ClerkProvider localization={nlNL}>{body}</ClerkProvider>
}
