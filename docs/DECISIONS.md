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

## Fase 2 — Normen- en bankdata

| # | Beslissing | Motivatie |
|---|---|---|
| D12 | Onderzoek vastgelegd in `/research/*.json` (bron-URL, datum en status per waarde); seeds worden daaruit gegenereerd met `scripts/build-norm-seed.ts` en `scripts/build-lender-seed.ts` | Herleidbaarheid: elke waarde in de app gaat terug op een onderzoeksregel met bron. Opnieuw genereren na nieuw onderzoek is één commando. |
| D13 | Financieringslasttabellen volledig overgenomen uit de Trhk (wetten.overheid.nl), inclusief de box 3-tabellen | De engine zoekt exact op zoals de regeling voorschrijft (inkomen afgerond op hele euro's, toetsrente op 3 decimalen). |
| D14 | Het alleenstaandenbedrag (€ 17.000, Trhk art. 3 lid 8) wordt behandeld als bedrag "buiten de financieringslast", net als de energielabelbedragen | Zo staat het in de regeling: het bedrag mag buiten beschouwing blijven bij het bepalen van de financieringslast. |
| D15 | Schattingen (kosten koper, verkoopkosten, Nibud-onderdelen, sale-and-leaseback) krijgen status *needs_verification* met de gevonden bandbreedte; de engine gebruikt de typische (midden)waarde | "Verzin nooit een getal": de bandbreedte komt uit een bron, de keuze voor het midden is gedocumenteerd en in de UI zichtbaar als te verifiëren. |
| D16 | Nibud publiceert geen openbaar totaalbedrag voor levensonderhoud. De begroting gebruikt alleen onderbouwde posten (minimale voeding, energie, water, gemeentelijke lasten, zorgverzekering, onderhoud) en toont de rest als "vrij besteedbaar" | Beter een eerlijk, deels onvolledig overzicht dan een verzonnen totaal. Groen = er blijft ≥ 10% van het netto-inkomen over (Nibud-spaaradvies). |
| D17 | Lenderprofielen worden in de database per criterium opgeslagen (`lender_criteria`, `lender_entrepreneur_policies`) met eigen bron en status | Elk criterium is afzonderlijk te verifiëren en te bewerken in /admin. `profile-kv.ts` zet profielen om van en naar rijen. |
| D18 | Energielabelkortingen per bank zijn handmatig gestructureerd uit de onderzoekstekst (`OVERRIDES` in het seed-script); ABN AMRO prijst per label met label A als basis, dus slechtere labels krijgen een opslag | De onderzoeksteksten zijn niet eenduidig machinaal te parsen; handmatige structurering is controleerbaar en gedocumenteerd. |
| D19 | NN: de enige openbare tabel dateert van 11-07-2026. De rentes zijn bijgewerkt met de actuele NHG-tarieven uit een secundaire bron (per periode dezelfde verschuiving op alle LTV-klassen) en gemarkeerd als *derived* / *needs_verification* | Een verouderde tabel zou NN onterecht goedkoop maken; de afgeleide tarieven zijn transparant gemarkeerd. |
| D20 | Inactieve geldverstrekkers (Aegon, BLG Wonen, Woonfonds, MoneYou) blijven in de vergelijking staan als "niet acceptabel" met de reden | De opdracht noemt ze expliciet; de gebruiker ziet zo waarom ze afvallen. bijBouwe blijkt géén opvolger van MoneYou; Lloyds Bank is toegevoegd als actieve online aanbieder. |
| D21 | Referentiedata (normen, banken, rentes) komt uit de database met een korte cache (60 s) en valt terug op de seed als de database niet bereikbaar is | De app blijft werken bij een tijdelijke databasestoring en in CI/preview zonder database. |
| D22 | Admin: een normwaarde kan alleen worden opgeslagen als de hele normenset daarna nog door de rekenkern kan worden gebouwd; een geverifieerde norm vereist een bron-URL; klonen naar een nieuw jaar zet alle waarden op "te verifiëren" | Voorkomt dat een beheerder de rekenkern breekt en dat oude waarden stilzwijgend als geverifieerd doorlopen. |
