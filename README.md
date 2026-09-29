# HypotheekCheck NL

Webapp die na een intake en het uploaden van documenten een volledig, onderbouwd en gecontroleerd
**indicatief** hypotheekadvies geeft: maximale hypotheek (Trhk/Nibud), financieringsopzet,
netto maandlasten over 30 jaar, bankvergelijking van 22 geldverstrekkers, stresstests,
overwaarde-opties en een volwaardig ondernemershoofdstuk (eenmanszaak, vof, BV, holding).

> Dit is een indicatie en geen financieel advies in de zin van de Wft. Raadpleeg voor een
> definitieve aanvraag een erkend hypotheekadviseur met een AFM-vergunning.

**Stack:** Next.js 16 (App Router) · TypeScript strict · Tailwind 4 + shadcn/ui · Clerk ·
Neon Postgres + Drizzle · Vercel Blob · Anthropic Claude · Zod · React Hook Form ·
@react-pdf/renderer · Recharts · Vitest · Playwright · Vercel Cron.

**Harde regel:** alle berekeningen zijn deterministisch en draaien in pure TypeScript
(`src/lib/engine`). Claude rekent nooit: het leest documenten uit en schrijft toelichting op basis
van de engine-uitvoer, waarna een automatische getallencheck elk getal controleert.

## Documentatie

| Document | Inhoud |
|---|---|
| [docs/ENGINE.md](docs/ENGINE.md) | Formules en modules van de rekenkern |
| [docs/ENTREPRENEURS.md](docs/ENTREPRENEURS.md) | Toetsinkomen ondernemers, BV/holding, scenario's |
| [docs/NORMS-2026.md](docs/NORMS-2026.md) | Alle normen 2026 met bron, datum en verificatiestatus |
| [docs/LENDERS.md](docs/LENDERS.md) | Geldverstrekkers, acceptatiecriteria en rentebronnen |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architectuur- en ontwerpbeslissingen |

---

## 1. Snel lokaal draaien (zonder externe accounts)

Voor ontwikkelen en testen kan de app volledig lokaal draaien met een ingebedde database
(PGlite), lokale documentopslag en een testlogin.

```bash
pnpm install
cp .env.example .env.local
```

Zet in `.env.local` minimaal:

```bash
DATABASE_URL=pglite:./.pglite
ENCRYPTION_KEY=<uitvoer van: openssl rand -base64 32>
CRON_SECRET=<uitvoer van: openssl rand -hex 32>
E2E_TEST_MODE=1          # inloggen met een test-id i.p.v. Clerk (alleen lokaal)
```

```bash
pnpm db:migrate          # tabellen aanmaken
pnpm db:seed             # normen 2025/2026, 22 geldverstrekkers en rentes
pnpm dev                 # http://localhost:3000 → Inloggen → vul een test-id in
```

Zonder `ANTHROPIC_API_KEY` werkt alles, behalve het automatisch uitlezen van documenten (je vult
de waarden dan zelf in) en de AI-teksten (de app gebruikt dan vaste teksten). Zonder
`BLOB_READ_WRITE_TOKEN` worden documenten lokaal in `.uploads/` bewaard.

> `E2E_TEST_MODE` en `pglite:` worden hard genegeerd/geweigerd op Vercel.

## 2. Tests en kwaliteitscontroles

```bash
pnpm typecheck       # next typegen + tsc --noEmit
pnpm lint            # ESLint (0 warnings)
pnpm test            # Vitest: rekenkern, normen, documenten, AI-checks, servicelaag (PGlite)
pnpm test:coverage   # coverage-drempel rekenkern: ≥ 90% regels
pnpm test:e2e        # Playwright: starter, doorstromer, verhogen, oversluiten, ondernemers, AVG, beheer
pnpm build
```

De e2e-tests starten zelf `next dev` met een verse lokale database en testlogin; er zijn geen
geheimen nodig (eerste keer: `pnpm exec playwright install chromium`).

---

## 3. Deploy-handleiding

### 3.1 GitHub-repository aanmaken en pushen

1. Maak op github.com een nieuwe, **private** repository aan (zonder README).
2. In deze map:

```bash
git remote add origin git@github.com:<jouw-account>/hypotheekcheck-nl.git
git push -u origin main
```

De GitHub Actions-workflow (`.github/workflows/ci.yml`) draait bij elke push typecheck, lint,
tests met coverage, build en de e2e-tests. Er zijn geen repository-secrets nodig.

### 3.2 Neon (database)

Je kunt Neon los aanmaken of via de Vercel Marketplace (zie 3.4, aanbevolen). Los:

1. Maak een account op [neon.tech](https://neon.tech) en een project, regio **Europe (Frankfurt,
   `eu-central-1`)**.
2. Kopieer de connection string (met `?sslmode=require`) en zet die als `DATABASE_URL` in
   `.env.local`.
3. Maak de tabellen aan en vul de referentiedata:

```bash
pnpm db:migrate
pnpm db:seed          # of: pnpm db:seed --force om bestaande normwaarden te overschrijven
```

Migraties staan in `drizzle/`; na een schemawijziging: `pnpm db:generate` en daarna
`pnpm db:migrate`.

### 3.3 Clerk (inloggen)

1. Maak op [dashboard.clerk.com](https://dashboard.clerk.com) een applicatie aan (bijv. e-mail +
   wachtwoord en/of Google).
2. **API Keys**: kopieer `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` en `CLERK_SECRET_KEY`.
3. Stel onder **Paths** in: sign-in `/sign-in`, sign-up `/sign-up`, na inloggen `/app`.
4. **Beheerder aanwijzen:** Users → kies de gebruiker → *Metadata* → **Public metadata**:

```json
{ "role": "admin" }
```

   Deze gebruiker ziet dan de link *Beheer* en heeft toegang tot `/admin` (normen, banken,
   rentes). De rol wordt server-side gecontroleerd via `currentUser()`; je hoeft de session token
   niet aan te passen.
5. In productie gebruik je een Clerk-productie-instance met een eigen domein (bijv.
   `clerk.jouwdomein.nl`). Voeg dat domein toe aan `CSP_EXTRA_HOSTS` (zie 3.4).

### 3.4 Vercel (hosting, database, opslag, cron)

1. Ga naar [vercel.com/new](https://vercel.com/new) en **importeer de GitHub-repository**.
   Framework: Next.js (automatisch). Build command en output: standaard laten.
2. **Neon koppelen via de Marketplace:** Project → *Storage* → *Create Database* → **Neon**
   (Serverless Postgres), regio Frankfurt. Vercel zet `DATABASE_URL` automatisch als
   environment variable. Draai daarna lokaal (met die `DATABASE_URL`) eenmalig `pnpm db:migrate`
   en `pnpm db:seed`.
3. **Blob koppelen:** Project → *Storage* → *Create* → **Blob**. Vercel zet
   `BLOB_READ_WRITE_TOKEN` automatisch. Documenten worden als *private* blobs opgeslagen.
4. **Environment variables** (Project → Settings → Environment Variables), voor Production en
   Preview:

| Variabele | Waarde |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | uit Clerk |
| `CLERK_SECRET_KEY` | uit Clerk |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `ANTHROPIC_API_KEY` | van [console.anthropic.com](https://console.anthropic.com) |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` (extractie en chat) |
| `ANTHROPIC_MODEL_REPORT` | `claude-sonnet-5` of `claude-opus-5-5` (adviesteksten) |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` — **bewaar veilig; zonder deze sleutel is de data onleesbaar** |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `DOCUMENT_RETENTION_DAYS` | `90` (optioneel) |
| `AI_RATE_LIMIT_PER_HOUR` | `30` (optioneel) |
| `NEXT_PUBLIC_APP_URL` | `https://<jouw-domein>` |
| `CSP_EXTRA_HOSTS` | bijv. `https://clerk.jouwdomein.nl` (Clerk-productiedomein) |
| `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` | automatisch via de integraties |

   Zet **nooit** `E2E_TEST_MODE` in Vercel.
5. **Cron:** `vercel.json` bevat twee jobs die Vercel automatisch registreert bij de deploy:

| Pad | Schema (UTC) | Doel |
|---|---|---|
| `/api/cron/rates` | `0 5 * * *` | rentes ophalen per bank (met terugval op laatst bekende tabel) |
| `/api/cron/cleanup` | `30 3 * * *` | documenten na de bewaartermijn verwijderen, opschonen |

   Vercel stuurt `Authorization: Bearer $CRON_SECRET` mee; zonder geheim geven de endpoints 401.
   Resultaten zie je op `/admin` (laatste cron-runs).
6. **Deploy** (Vercel bouwt automatisch bij elke push naar `main`). Controleer daarna:
   registreren, een dossier doorlopen, een document uploaden, advies en PDF.

### 3.5 Na de eerste deploy

- Log in als beheerder en controleer op `/admin/normen` welke waarden nog *te verifiëren* zijn
  (zie ook [docs/NORMS-2026.md](docs/NORMS-2026.md)).
- Werk rentes bij die alleen als pdf worden gepubliceerd via `/admin/geldverstrekkers/<bank>`.
- Nieuw belastingjaar: *Normen → Klonen naar jaar*, waarden controleren en bronnen invullen,
  daarna *Activeren*.

---

## 4. Architectuur in het kort

```
src/
  app/                  Pagina's en route handlers (App Router)
    app/                Beschermd: dossiers, intake-wizard, documenten, advies, wat-als, chat, account
    admin/              Beheer (rol admin): normen, banken, rentes
    api/                Upload/download documenten, PDF, export, cron
  lib/
    engine/             Rekenkern (puur, isomorf, 97% coverage) + ondernemersmodule
    norms/              Normensets: seed 2025/2026 en bouwer naar getypeerde NormSet
    lenders/            Geldverstrekkers, rentes en rente-adapters
    intake/             Zod-schema's per stap en mapping naar de engine
    documents/          Documenttypes, checklist, extractie-normalisatie, BSN-verwijdering, consistentie
    ai/                 Claude: extractie, adviesteksten, chat, anti-hallucinatiecheck
    services/           Servicelaag met autorisatie op userId (dossiers, documenten, advies, AVG)
    db/                 Drizzle-schema (versleutelde datakolommen) en client
    pdf/                PDF-rapport
research/               Onderzoeksdata (bron per waarde) waaruit de seeds worden gebouwd
scripts/                Seed, docs genereren, e2e-voorbereiding
e2e/                    Playwright-tests
```

- **Autorisatie:** `proxy.ts` beschermt `/app` en `/admin`; elke pagina, server action en route
  handler controleert zelf sessie en eigendom (alle queries filteren op `userId`).
- **Versleuteling:** persoons- en financiële gegevens staan versleuteld (AES-256-GCM) in de
  database; documenten staan privé in Blob en zijn alleen via kortlevende, ondertekende links op
  te vragen.
- **Privacy:** geen BSN-opslag, geen persoonsgegevens in logs of URL's, audit-log van inzage,
  export en verwijdering (AVG art. 15/17/20), alleen functionele cookies.

## 5. Onderzoek en seeds bijwerken

```bash
pnpm tsx scripts/build-norm-seed.ts     # research/norms-*.json → src/lib/norms/seed/
pnpm tsx scripts/build-lender-seed.ts   # research/lenders-*.json → src/lib/lenders/seed/
pnpm tsx scripts/generate-docs.ts       # docs/NORMS-2026.md en docs/LENDERS.md
pnpm db:seed
```
