# Architectuur- en ontwerpbeslissingen

Dit document legt de beslissingen vast die tijdens de bouw van HypotheekCheck NL zelfstandig zijn
genomen. Elke beslissing heeft een korte motivatie.

## Fase 1 — Scaffold

| # | Beslissing | Motivatie |
|---|---|---|
| D1 | Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript strict | Laatste stabiele versie op 29-09-2026. In Next 16 heet `middleware.ts` nu `proxy.ts`; route-params zijn async. |
| D2 | Clerk Core 3 (`@clerk/nextjs` 7) met `clerkMiddleware` in `src/proxy.ts` | `/app(.*)` en `/admin(.*)` zijn beschermd. API-routes checken zelf auth en eigendom (401/403) zodat ze JSON teruggeven in plaats van een redirect. `<SignedIn>`/`<SignedOut>` bestaan niet meer in Core 3; we gebruiken `<Show when="signed-in">`. |
| D3 | Admin-rol via `publicMetadata.role === "admin"`, gecontroleerd met `currentUser()` op de server | Werkt zonder dat de session-token in het Clerk-dashboard aangepast hoeft te worden. |
| D4 | Neon via de HTTP-driver (`drizzle-orm/neon-http`) | Geschikt voor serverless (Vercel); geen connection pooling nodig. |
| D5 | Gevoelige data in één versleutelde kolom (`data`, AES-256-GCM) per rij, met een paar niet-gevoelige, geïndexeerde kolommen (type, positie, jaar) | Voldoet aan "versleutel gevoelige velden op applicatieniveau" zonder tientallen losse versleutelde kolommen. Een custom Drizzle-type versleutelt bij schrijven en ontsleutelt bij lezen. |
| D6 | Env-validatie met Zod in `src/env.ts`, lui per variabele | `next build` en unit tests draaien zonder productiesecrets; een ontbrekende variabele geeft een duidelijke fout op het moment dat hij nodig is. |
| D7 | Vitest 4 in plaats van 5 | Vitest 5 vereist Node ≥ 22.12. Vitest 4 werkt op Node 20.19 (lokale omgeving) én 22 (CI). |
| D8 | shadcn/ui "base-nova" (Base UI-primitives) | Huidige standaard van de shadcn CLI. Knoppen die als link dienen, zijn echte `<a>`-elementen via `ButtonLink` (toegankelijkheid). |
| D9 | `pnpm typecheck` = `next typegen && tsc --noEmit` | Next 16 genereert de globale `PageProps`/`LayoutProps`-typen; die moeten er zijn vóór `tsc`. |
| D10 | Standaardmodel `claude-sonnet-5` | De opdracht noemt `claude-sonnet-5-5`, maar dat model-ID bestaat niet. `claude-sonnet-5` is het actuele Sonnet-model; `claude-opus-5-5` is instelbaar voor het eindrapport via `ANTHROPIC_MODEL_REPORT`. |
| D11 | E2E-testmodus (`E2E_TEST_MODE=1`) met auth via een testcookie | Maakt volledige e2e-flows mogelijk zonder echte Clerk-account. Wordt hard uitgeschakeld als `VERCEL=1` of `VERCEL_ENV=production`. |
