# Rekenkern (`src/lib/engine`)

De rekenkern is pure, deterministische TypeScript: geen I/O, geen klok, geen randomness. Dezelfde
invoer (`EngineInput`), normenset (`NormSet`) en bankdata (`LenderProfile[]`, `RateRow[]`) geven
altijd dezelfde uitvoer (`AdviceOutput`). De kern draait op de server en in de browser (wat-als-modus).
**Het LLM rekent nooit**: het leest documenten uit en schrijft toelichting op basis van deze uitvoer.

- Versie: `ENGINE_VERSION` in `advice.ts` (wordt bij elke berekening opgeslagen, samen met de versie van de normenset en een hash van de invoer).
- Bedragen in euro's, percentages in procenten (5 = 5%), datums als `YYYY-MM-DD`.
- Rentes per maand: nominaal, `r = jaarrente / 12`.
- Afronding: de maximale hypotheek wordt naar **beneden** afgerond op hele euro's; het benodigde bedrag naar **boven**.

## Herleidbaarheid

Elke kernuitkomst krijgt een `TraceEntry` (id, label, waarde, eenheid, formule, invoer en `normKeys`).
De normsleutels verwijzen naar `norm_values` (waarde, jaar, bron-URL, datum van controle, status).
`collectNormKeys()` verzamelt alle gebruikte sleutels; het rapport toont die als "Aannames en bronnen".
De anti-hallucinatiecheck (zie `src/lib/ai/number-check.ts`) vergelijkt elk getal in de AI-tekst met de getallen in deze uitvoer.

## Modules

| Module | Bestand | Verantwoordelijkheid |
|---|---|---|
| Wiskunde | `math.ts` | annuïteit, contante waarde, restschuld, schijventarief |
| Datums/AOW | `age.ts` | leeftijd, AOW-leeftijd uit het vastgestelde schema |
| Toetsinkomen loondienst | `income/employee.ts` | contractvormen, IBL, uitkering, pensioen, alimentatie |
| Toetsinkomen ondernemer | `entrepreneur/*` | zie [ENTREPRENEURS.md](ENTREPRENEURS.md) |
| Financieringslast | `capacity/financieringslast.ts` | tabelopzoeking, toetsrente |
| Verplichtingen | `capacity/obligations.ts` | BKR 2%, lease, studieschuld |
| Leencapaciteit inkomen | `capacity/income-capacity.ts` | Trhk art. 3–4, AOW-toets |
| Onderpand en NHG | `capacity/collateral.ts` | LTV 100/106%, NHG-kostengrens |
| Kosten koper/verkoop | `costs/purchase-costs.ts` | OVB, startersvrijstelling, notaris, NHG, bankgarantie |
| Financieringsopzet | `financing/purchase.ts` | benodigd − eigen middelen, bijleenregeling |
| Doorstromer | `mover/move.ts` | overwaarde, EWR, meeneemregeling, overbrugging, dubbele lasten |
| Boeterente/oversluiten | `mover/penalty.ts` | contante waarde renteverschil, terugverdientijd, rentemiddeling |
| Maandlasten | `loan/schedule.ts` | annuïtair/lineair/aflossingsvrij, 30 jaar bruto en netto |
| Fiscaal | `tax/*` | box 1, heffingskortingen, EWF, Hillen, box 2/3, Vpb |
| Eigen geld | `equity/optimize.ts` | inbrengen vs. aanhouden |
| Overwaarde-opties | `options/equity-release.ts` | verbouwen, verduurzamen, aflossen/sparen/beleggen, oversluiten, consumptief, schenken, senioren |
| Begroting | `budget/budget.ts` | Nibud-achtige begroting |
| Stresstests | `stress/stress.ts` | rente, uitval, AO, WW, overlijden, pensioen, scheiding, waardedaling |
| Banken | `lenders/*` | rente-opzoeking, acceptatie, rangschikking |
| Controles | `checks/checks.ts` | "gecheckt op" met stoplicht, norm en bron |
| Scenario's | `scenarios/scenarios.ts` | max. 4 varianten naast elkaar |
| Orkestratie | `advice.ts` | `runAdvice()` combineert alles per doel |

## 1. Toetsinkomen (loondienst)

| Bron | Telt mee | Voorwaarde bij de bank |
|---|---|---|
| Vast contract | salaris + vakantiegeld + vaste 13e maand + vaste eindejaarsuitkering + structurele ORT + structurele provisie | – |
| Tijdelijk met intentieverklaring | idem | `accepts.intentieverklaring` |
| Perspectiefverklaring | idem | `accepts.perspectiefverklaring` |
| Tijdelijk/flex zonder intentie | IBL-toetsinkomen (UWV) | `accepts.flexIBL` |
| Duurzame uitkering (IVA, Wajong) | bruto jaarbedrag | `accepts.benefits` |
| WW | 0 | – |
| Pensioen / AOW / lijfrente | bruto jaarbedrag | `accepts.pension` |
| Ontvangen partneralimentatie | bruto jaarbedrag (NHG C.7.14) | – |
| Huurinkomsten | 0 (geen vast inkomen in de standaardtoets) | – |

Bij een bank die een vereiste eigenschap **niet** accepteert, telt dat inkomen daar niet mee (met reden in de vergelijking). Onbekend = meegeteld onder voorbehoud.

## 2. Maximale hypotheek op inkomen (Trhk art. 3 en 4)

```
toetsrente            = max(AFM-toetsrente 5%, werkelijke rente)   als rentevast < 10 jaar
                      = werkelijke rente                           als rentevast ≥ 10 jaar
gezamenlijk inkomen   = hoogste inkomen + overige × 100% (partnerinkomen) − betaalde partneralimentatie
tabel                 = regulier | AOW (als de aanvrager met het hoogste inkomen AOW-gerechtigd is)
                        box 3-varianten als de rente niet aftrekbaar is
pct                   = tabel[rij(inkomen afgerond naar beneden)][kolom(toetsrente op 3 decimalen)]
woonlast per maand    = inkomen × pct / 12
ruimte per maand      = woonlast − verplichtingen − erfpachtcanon/12
basis                 = ruimte × (1 − (1+r)^−360) / r         (r = toetsrente/12)
max hypotheek         = basis + energielabelbedrag + energiebesparend (≤ maximum bij label)
                        + alleenstaandenbedrag (één aanvrager, inkomen > drempel)
```

- Inkomens onder de eerste tabelrij krijgen het percentage van de eerste rij; boven de laatste rij de laatste rij.
- **Verplichtingen**: doorlopend krediet en persoonlijke lening 2% van de limiet/hoofdsom per maand; private lease de werkelijke termijn × factor; studieschuld de DUO-termijn × bruteringsfactor bij de toetsrente (1,05–1,40). In de aanloopfase, aflosvrije periode of bij draagkracht wordt de termijn berekend als annuïteit over restschuld, rente en resterende looptijd (Trhk art. 3a).
- **AOW-toets** (art. 2 lid 5): voor elk moment binnen 10 jaar waarop een aanvrager AOW-gerechtigd wordt, rekenen we opnieuw met het inkomen na AOW (AOW + pensioen; bij onbekend pensioen alleen de AOW, met waarschuwing) en de AOW-tabel. De laagste uitkomst is bepalend.

## 3. Maximale hypotheek op onderpand

```
max = marktwaarde (na verbouwing) × min(100%, max LTV bank) + min(energiebesparend, 6% × marktwaarde)
```

NHG is mogelijk als de lening ≤ kostengrens (met energiebesparende voorzieningen de hogere grens), bij eigen bewoning en zonder nieuw aflossingsvrij deel. Borgtochtprovisie = 0,4% van de lening.

## 4. Financieringsopzet (aankoop)

```
benodigd   = koopsom + meerwerk + verbouwing + energiebesparend + kosten koper (+ restschuld)
bronnen    = eigen geld + overwaarde + schenking + familiebank
hypotheek  = min(benodigd − bronnen, maximale hypotheek)
tekort     = (benodigd − bronnen) − hypotheek
```

- Eigen geld = spaargeld + beleggingen − gewenste buffer (of de opgegeven inbreng).
- NHG-provisie hangt af van het leenbedrag: we itereren tot het bedrag stabiel is.
- **Kosten koper uit eigen middelen**: de hypotheek is begrensd op 100% van de marktwaarde (+ energie). De check is groen als de hypotheek ≤ marktwaarde + energiebesparend.
- **Overdrachtsbelasting**: nieuwbouw v.o.n. 0; startersvrijstelling per koper (jonger dan 35, eigen bewoning, koopsom ≤ grens, niet eerder gebruikt; bij twee kopers per 50%); anders 2% bij eigen bewoning en 8% (2026) voor overige woningen.
- **Bijleenregeling**: maximale eigenwoningschuld = koopsom + niet-aftrekbare kosten koper + meerwerk + verbouwing + energiebesparend − eigenwoningreserve. Het meerdere wordt een box 3-leningdeel.
- **Bouwrente** (nieuwbouw, indien niet opgegeven): 50% × bouwbedrag × rente × bouwmaanden/12 (aanname lineaire opname).

## 5. Doorstromer

```
verkoopkosten      = courtage% × verkoopprijs + royement + overige verkoopkosten
overwaarde         = verkoopprijs − verkoopkosten − totale schuld + opgebouwde waarde
restschuld         = max(0, −overwaarde)
eigenwoningreserve = max(0, verkoopprijs − verkoopkosten − eigenwoningschuld)
overbrugging       = max(0, overwaarde), rente × maanden / 12 (aftrekbaar)
dubbele lasten     = maanden × (bruto maandlast oude woning − renteaftrek)
```

Meegenomen leningdelen (meeneemregeling) houden rente, resterende rentevaste periode, looptijd en fiscale status (incl. overgangsrecht van vóór 2013, ook aflossingsvrij). Ze tellen mee in de nieuwe totale hypotheek; het nieuwe deel = totaal − meegenomen deel.

## 6. Maandlasten en netto lasten (30 jaar)

Per leningdeel per maand: rente = saldo × r; annuïtair: aflossing = termijn − rente (termijn herberekend na de rentevaste periode); lineair: hoofdsom / looptijd; aflossingsvrij: aflossing aan het eind.

Per jaar:
```
EWF        = WOZ × percentage (schijf); boven € 1.350.000: € 4.725 + 2,35% × meerdere (2026)
saldo      = EWF − aftrekbare rente
saldo < 0  → voordeel = −saldo × min(marginaal tarief, max. aftrektarief 37,56%)
saldo > 0  → Wet Hillen: extra belasting = saldo × (1 − Hillen%) × marginaal tarief
netto      = bruto − voordeel
```

- Aftrek geldt voor delen die annuïtair/lineair in 30 jaar worden afgelost of onder het overgangsrecht (vóór 2013) vallen.
- Het belastbaar inkomen van de partner met het hoogste inkomen bepaalt het tarief (fiscale partners mogen de aftrek toedelen). Na diens AOW-datum: pensioeninkomen en AOW-tarieven.
- Aannames voor toekomstige jaren: fiscale parameters constant (behalve Hillen: jaarlijks dezelfde afbouwstap als tussen de laatste twee jaren, tot 0%); rente na de rentevaste periode gelijk (tenzij stresstest); woningwaarde en WOZ stijgen met `markt.woningwaardestijging_verwachting`.

## 7. Verstandig lenen en begroting

Het verstandige leenbedrag is het hoogste bedrag (≤ maximale hypotheek, afgerond op € 1.000) waarbij
netto-inkomen − vaste lasten − netto woonlast ≥ 10% van het netto-inkomen (Nibud-spaaradvies), en
de netto maandlast ≤ het door de gebruiker opgegeven maximum (bisectie).

Netto-inkomen = bruto − box 1 + algemene heffingskorting + arbeidskorting (per persoon). Overige
heffingskortingen (bijv. IACK) blijven buiten beschouwing: de uitkomst is licht conservatief.

Begroting: netto woonlasten, VvE, erfpacht, onderhoud (1% van de woningwaarde per jaar), energie
en water (per huishoudgrootte), gemeentelijke lasten, zorgverzekering + eigen risico, minimale
voeding (Nibud), leningen/lease/studieschuld en zelf opgegeven vaste lasten.

## 8. Eigen geld optimaliseren

Varianten 0%, 50% en 100% van het vrije spaargeld (boven de buffer, minimaal het tekort):
rente bij de nieuwe LTV-klasse (mediaan van de banken), netto rentelasten over 10 en 30 jaar,
spaarrendement (spaarrente − box 3) over dezelfde periode. Aanbeveling: laagste netto kosten
over 10 jaar waarbij de buffer (max. van de gewenste buffer en het Nibud-voorbeeld) intact blijft.

## 9. Overwaarde zonder aankoop

| Optie | Rekenwijze | Fiscaal |
|---|---|---|
| Verhogen voor verbouwing | annuïteit over het extra bedrag; netto na renteaftrek | aftrekbaar (verbetering eigen woning) |
| Verduurzamen | idem, extra ruimte tot 106% LTV | aftrekbaar |
| Aflossen / sparen / beleggen | groei tegen netto rendement: aflossen = rente × (1 − aftrektarief) + bespaarde box 3; sparen = spaarrente − box 3; beleggen = verwacht rendement (Commissie Parameters) − box 3 | box 1/box 3 |
| Oversluiten | boeterente vs. maandbesparing, terugverdientijd, rentemiddeling | boete aftrekbaar |
| Vrij opnemen | annuïteit bruto, box 3-tabel | niet aftrekbaar; schuld in box 3 |
| Schenken aan kinderen | jaarlijkse vrijstelling × kinderen; jubelton bestaat niet meer | schenkbelasting |
| Verzilverhypotheek | max. 50% marktwaarde − schuld; schuld groeit met rente-op-rente | box 3 |
| Verkoop met terughuur | 80% van marktwaarde, huur 5% per jaar | box 3 |

De percentages voor senioren zijn modelparameters (status *te verifiëren*, zie norm `senioren.*`).

## 10. Stresstests (stoplicht)

| Scenario | Maatstaf | Groen / oranje / rood |
|---|---|---|
| Rente +1% en +2% bij renteherziening | extra bruto maandlast vs. vrij besteedbaar | ruim / krap / tekort |
| Uitval inkomen aanvrager 1 of 2 | max. hypotheek op één inkomen ÷ hypotheek | ≥ 1 / begroting sluit / tekort |
| Arbeidsongeschiktheid | IVA 75% van (gemaximeerd) loon; ondernemer: AOV-uitkering | begroting |
| Werkloosheid | WW 75%/70% van (gemaximeerd) dagloon; duur 3 + 1 mnd/jaar (max. 24); ondernemer: geen WW | begroting en buffer |
| Overlijden | inkomen nabestaande + nabestaandenpensioen + ANW (kinderen < 18); ORV lost af | ratio en begroting |
| Pensionering | max. hypotheek op pensioeninkomen ÷ restschuld op pensioendatum | ratio en begroting |
| Echtscheiding | max. hypotheek alleen ÷ (hypotheek + helft overwaarde) | ≥ 1 / ≥ 0,85 / < 0,85 |
| Waardedaling −10% en −20% | LTV en restschuld bij verkoop | ≤ 100% / ≤ 110% / > 110% |

## 11. Bankadvies

Per bank: acceptatie (inactief, LTV, aflossingsvrij deel, inkomensvormen, ondernemersbeleid,
restschuld, overbruggingsduur, vrij opnemen), toetsinkomen volgens het bankbeleid, maximale
leenruimte met de bankrente, rente uit de rentetabel (LTV-klasse, NHG, periode, aflossingsvorm,
energielabelkorting), netto maandlast jaar 1 en gemiddeld over de rentevaste periode, totale
kosten = rente over de rentevaste periode + afsluitkosten, en flexibiliteit (meeneemregeling,
verhuisregeling, boetevrij aflossen, rentemiddeling, bouwdepot).

Rangschikking: (1) geaccepteerd en passend, (2) onder voorbehoud en passend, (3) niet passend,
(4) niet geaccepteerd; binnen een groep op totale kosten, dan flexibiliteit. Top 3 = de eerste drie
passende banken met een bekende rente.

## 12. Tests

- `__tests__/reference-cases.test.ts`: 32 handgerekende algemene casussen (starter, stel, AFM-toetsrente, studieschuld, BKR, lease, AOW, AOW binnen 10 jaar, energielabel, alimentatie, erfpacht, lage/hoge inkomens, box 3, LTV, NHG, startersvrijstelling, nieuwbouw, doorstromer met overwaarde en restschuld, hypotheek van vóór 2013, boeterente, netto lasten, Hillen, box 3, volledige flows).
- `__tests__/entrepreneur-cases.test.ts`: 18 ondernemerscasussen (zie ENTREPRENEURS.md).
- `__tests__/goals.test.ts`, `scenarios.test.ts`, `units.test.ts`: alle doelstromen, scenario's en randgevallen.
- Coverage-drempel (Vitest): 90% regels/statements/functies, 80% branches voor `src/lib/engine`.
