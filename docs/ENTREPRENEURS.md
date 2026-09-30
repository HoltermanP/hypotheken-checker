# Ondernemers (`src/lib/engine/entrepreneur`)

Ondernemers zijn een volwaardige doelgroep. Het toetsinkomen wordt **per geldverstrekker** berekend
volgens diens beleid (`lender_entrepreneur_policies`). Onbekende beleidsvelden vallen terug op het
standaardbeleid hieronder, zodat de uitkomst altijd berekend kan worden (onder voorbehoud).

| Beleidsveld | Standaard als onbekend |
|---|---|
| Minimaal aantal jaren cijfers | 3 |
| Prognose voor starters | nee |
| IVO | geaccepteerd (niet verplicht) |
| Rekenmethode | gemiddelde 3 jaar, laatste jaar als plafond indien lager |
| DGA-behandeling | salaris + duurzaam uitkeerbare winst |
| Min. solvabiliteit / current ratio | 20% / 1,0 (modelaanname) |
| DGA vanaf aandelenbelang | 5% |

## 1. IB-ondernemer (eenmanszaak, vof, maatschap, cv)

```
gecorrigeerde winst = winst vóór ondernemersaftrek (bij vof: eigen winstaandeel)
                      − incidentele baten + incidentele lasten + afname FOR
```

De FOR is per 2023 afgeschaft: een bestaande FOR blijft staan, een afname telt als winst.

Rekenmethoden (`applyMethod`):

| Methode | Formule |
|---|---|
| `avg3_capped_by_last` (standaard) | gemiddelde laatste 3 jaar; is het laatste jaar lager, dan het laatste jaar |
| `avg3` | gemiddelde laatste 3 jaar |
| `last_year` | laatste jaar |
| `weighted` | (1 × oudste + 2 × middelste + 3 × laatste) / 6 |
| `ivo` | toetsinkomen uit de Inkomensverklaring Ondernemer |

Starters (minder jaren dan de bank vraagt): alleen als de bank een prognose accepteert en er ten
minste één jaar cijfers is: `min(gemiddelde van de beschikbare jaren, prognose)`. Anders niet
geaccepteerd (of onder voorbehoud als het bankbeleid onbekend is).

Een IVO gaat voor bij banken die IVO accepteren of vereisen. Vereist de bank een IVO en ontbreekt
die, dan is de uitkomst "onder voorbehoud" en noemt het rapport de ontbrekende documenten.

## 2. DGA (BV)

```
toetsinkomen = salaris (laatste jaar) + [uitkeerbare winst × aandelenbelang]   (als de bank winst meetelt)

uitkeerbare winst = min( winstcapaciteit, solvabiliteitsruimte, liquiditeitsruimte, vrije reserves )
  winstcapaciteit     = rekenmethode van de bank over het genormaliseerde resultaat na belasting
  genormaliseerd      = resultaat na belasting − incidentele posten × (1 − effectief Vpb-tarief)
  solvabiliteitsruimte = (EV − s × BT) / (1 − s)          zodat (EV − p) / (BT − p) ≥ s
  liquiditeitsruimte   = min(liquide middelen, VA − c × KVV) zodat de current ratio ≥ c blijft
  vrije reserves       = EV − geplaatst kapitaal          (uitkeringstoets)
```

- Onder de DGA-grens van de bank (bijv. < 5%) wordt de aandeelhouder als werknemer behandeld: alleen salaris.
- Salaris onder het normbedrag van de gebruikelijkloonregeling (2026: € 58.000) geeft een waarschuwing.
- Het rapport toont per bank het toetsinkomen, de methode en welke toets bepalend is.
- **Incidentele posten** (vóór belasting, bate positief) worden per jaar na belasting uit het resultaat gehaald; het effectieve tarief is Vpb / resultaat vóór belasting (valt terug op 19%). Een laatste jaar dat onder 70% van het gemiddelde ligt, geeft een waarschuwing.
- Aangeleverde geconsolideerde cijfers (`bv.consolidated`) gaan vóór de zelf berekende consolidatie.

### Cijfers uit bestanden (`/app/dossiers/[id]/ondernemer`)

1. De gebruiker uploadt één of meer bestanden van het documenttype `jaarcijfers_onderneming`: jaarrekening (pdf/foto), Excel/CSV of een jaaroverzicht/jaaropgave DGA.
2. **Excel-sjabloon** (`/api/templates/jaarcijfers`, herkend aan de marker in cel A1) wordt exact ingelezen, zonder AI. Andere spreadsheets gaan als tekst (per tabblad) naar Claude; pdf's en afbeeldingen als document. Claude leest per entiteit en per jaar af (ook vergelijkende cijfers), rekent niets uit en markeert prognoses.
3. `mergeFinancials` voegt alle bestanden samen per entiteit (op genormaliseerde naam) en jaar; de waarde met de hoogste zekerheid wint; verschillen > 1% worden als conflict getoond.
4. De gebruiker controleert en corrigeert de cijfers in een tabel; het toetsinkomen per bank rekent direct mee in de browser (dezelfde rekenkern).
5. "Overnemen in intake" (`applyFinancialsToBusiness`) koppelt entiteiten, legt de holdingstructuur vast, zet salarissen, belang, geplaatst kapitaal, rekening-courant en geconsolideerde cijfers, en markeert de bestanden als bevestigd. Prognosejaren worden niet overgenomen; maximaal de laatste 4 jaren blijven bewaard.

## 3. Holding met werkmaatschappij(en)

Er wordt gerekend met geconsolideerde cijfers (aangeleverd, of berekend):

- Dochters met een meerderheidsbelang volledig, anders naar rato van het belang.
- **Eliminaties**: resultaat uit deelnemingen en boekwaarde van deelnemingen (holding), de onderlinge management fee (omzet holding = kosten werkmaatschappij), onderlinge vorderingen/schulden.
- **Management fee**: telt alleen mee voor het salaris uit de holding als die zakelijk, structureel én contractueel is vastgelegd (en de bank fees meetelt). Anders telt het deel van het salaris dat de holding alleen uit de fee kan betalen niet mee.
- Vrije reserves in de holding (vermogen buiten de onderneming) zitten in de geconsolideerde vermogens- en liquiditeitstoetsen.
- Een fiscale eenheid Vpb wordt vastgelegd; de consolidatie is daarvan onafhankelijk.

## 4. Continuïteitsrisico (0–100)

| Onderdeel | Max. punten | Berekening |
|---|---|---|
| Trend winst | 25 | dalende helling (kleinste kwadraten) t.o.v. gemiddelde |
| Schommeling | 20 | variatiecoëfficiënt × 40 (waarschuwing boven 0,25) |
| Grootste opdrachtgever | 20 | > 50%: 20; > 30%: 10 |
| Branche | 15 | modeltabel (horeca 15 … zorg 2) |
| Solvabiliteit (BV) | 10 | < 10%: 10; < 20%: 5 |
| Bestaansduur | 10 | < 3 jaar: 10 |

0–25 laag, 26–50 gemiddeld, > 50 hoog. Dit is een modelaanname ter duiding, geen bankcriterium.

## 5. Scenario's en adviezen

| Scenario | Rekenwijze |
|---|---|
| Salaris verhogen (+ € 10.000) | extra box 1 (netto-inkomensverschil) − Vpb-besparing (marginaal tarief); variant incl. uitgespaarde latere box 2. Per bank: extra toetsinkomen (herberekend met aangepaste BV-cijfers) en extra leenruimte. |
| Dividend uitkeren | box 2 over het dividend; verlaagt EV en liquiditeit (en dus de uitkeerbare winst) |
| Eigen geld uit de BV | bruto dividend zodat netto het benodigde bedrag overblijft (iteratief over box 2-schijven) vs. lenen van de BV (zakelijke rente, aftrekbaar bij hypotheekrecht en aflossingseis) vs. laten staan |
| Hypotheek bij eigen BV | bank: rente × (1 − aftrektarief). BV: privé netto rente − (rente − Vpb − box 2 bij uitkering) = netto kosten voor privé + BV samen |
| Wet excessief lenen | schulden aan eigen BV op 31-12, minus eigenwoningschulden met hypotheekrecht (en eigenwoningschulden van vóór 2023) > € 500.000 → meerdere belast in box 2 |
| Overwaarde voor de onderneming | niet aftrekbaar in box 1; banken die dit (bevestigd) toestaan worden genoemd; risico bij faillissement |
| Woning in de BV | alleen op verzoek: OVB 8% i.p.v. 2%, geen eigenwoningregeling, bijtelling/huur, dubbele heffing |
| Timing | als de volgende jaarcijfers binnen 12 maanden komen en een verwachte winst is opgegeven: toetsinkomen en leenruimte met het extra jaar |

Adviezen: AOV of broodfonds (geen WW, meestal geen WIA), overlijdensrisicoverzekering,
privé-aansprakelijkheid bij eenmanszaak/vof, borgstellingen en huwelijkse voorwaarden.
De stresstests gebruiken voor ondernemers de AOV-uitkering en de buffer in plaats van WW/WIA.

## 6. Referentiecasussen (`__tests__/entrepreneur-cases.test.ts`)

| # | Casus | Verwachte uitkomst (handberekend) |
|---|---|---|
| E1 | Starter-eenmanszaak, 1 jaar cijfers (45k), prognose 50k | standaard niet geaccepteerd; bank met 1 jaar: 45.000; met prognose: min(45k, 50k); lagere prognose 40k bepalend |
| E2 | Stijgende winst 40k/50k/60k | 50.000 (plafond gemiddelde); gewogen 53.333,33; laatste jaar 60.000 |
| E3 | Dalend laatste jaar 60k/70k/45k | 45.000; met incidentele bate van 10k in jaar 2: gemiddelde 55.000 (avg3) |
| E4 | Vof, twee vennoten (45k/48k/50k elk) | 47.666,67 per vennoot; gezamenlijk 95.333,33 |
| E5 | ZZP (20k/25k/22k) + loondienst 30k | 52.000 |
| E6 | DGA, bank telt alleen salaris | 60.000 |
| E7 | DGA, hoge reserves, goede solvabiliteit | winstcapaciteit 90.000 bepalend → 150.000 |
| E8 | DGA, slechte liquiditeit | liquiditeitsruimte 10.000 → 70.000 |
| E9 | Holding + werkmaatschappij + management fee | geconsolideerd 116.000, EV 500k, BT 820k → 186.000 |
| E10 | Holding + 2 werkmaatschappijen (100% en 40%), fiscale eenheid | geconsolideerd 76.000 → 136.000 |
| E11 | Lening eigen BV 300k | onder drempel, geen box 2 |
| E12 | Leningen eigen BV 650k telbaar | excess 150.000 → box 2 € 42.025,20 |
| E13 | Management fee niet contractueel | salaris telt niet → 116.000 |
| E14 | IVO | IVO-inkomen 55.000; IVO vereist maar ontbreekt → onder voorbehoud |
| E15 | Belang 4% (< DGA-grens) | als werknemer: 60.000 |
| E16 | Schommelende winst, afhankelijk van één klant | risico hoog, waarschuwingen |
| E17 | Salaris vs. dividend (+10k) | box 2 dividend 2.450; Vpb-besparing salaris 1.900 |
| E18 | Volledige flow DGA met holding | toetsinkomen per bank (≥ 15 banken), consolidatie, scenario's, ontbrekende IVO-documenten |
