# Geldverstrekkers

> Automatisch gegenereerd uit `src/lib/lenders/seed/` met `pnpm tsx scripts/generate-docs.ts`. Onderzoek: september 2026 (zie `/research/lenders-*.json` voor de volledige brontekst per veld).

- Opgenomen: **22** geldverstrekkers, waarvan **18** actief voor nieuwe hypotheken.
- Rentes: **2679** tariefregels (bank × rentevaste periode × LTV-klasse × aflossingsvorm).
- Onbekende criteria staan op *onbekend* (null). De engine behandelt onbekend als "niet uitgesloten, met voorbehoud" en toont dat in de acceptatiereden.

## Niet (meer) actief

- **Aegon**: Niet meer actief als hypotheekmerk (gecontroleerd 29-09-2026). Alle aegon.nl-URL's (incl. /hypotheek, /hypotheek/hypotheekrente, /adviseur/hypotheken) worden 301-doorgestuurd naar https://www.asr.nl/hallo-klant-van-aegon ('Aegon Nederland is nu onderdeel van a.s.r.'). Volgens a.s.r. zijn de Aegon-hypotheken in 2025 verhuisd naar het a.s.r.-administratiesysteem en is de naam veranderd in a.s.r.; de rekening van Aegon Hypotheken B.V. heet nu ASR Hypotheken B.V. Nieuwe hypotheken worden aangeboden als a.s.r. hypotheek (https://www.asr.nl/hypotheek). Geen aparte Aegon-rentetabel of acceptatiecriteria meer gepubliceerd.
- **BLG Wonen**: BLG Wonen officially became ASN Bank on 1 March 2026 (last de Volksbank brand merged). New mortgages are offered under ASN Bank (ASN Hypotheek / Bespaarhypotheek); existing BLG customers are serviced by ASN Bank. Source: https://newsroom.asnbank.nl/blg-wonen-nu-ook-officieel-asn-bank/
- **Woonfonds**: Brand discontinued: on 24-25 March 2025 all ~30,000 Woonfonds mortgages moved to Centraal Beheer (Achmea). No new Woonfonds mortgages. Source: https://www.vvponline.nl/nieuws/centraal-beheer-neemt-woonfonds-klanten-over-en-groeit-fors-in-hypotheken ; woonfonds.nl no longer resolves.
- **Moneyou**: Since 12 November 2025 no new Moneyou Hypotheek can be taken out by new customers (purchase or refinance). Existing customers keep service: rate changes, increases, verhuisregeling. Moneyou remains part of ABN AMRO Hypotheken Groep; no successor brand named (bijBouwe is NOT a successor). Source: https://www.moneyou.nl/vragen

## Overzicht rentes

| Geldverstrekker | Rentedatum | Status | Bron |
|---|---|---|---|
| ABN AMRO | 2026-09-21 | verified | [link](https://hypotheken.abnamro.nl/interest-rates/app/?lang=nl) |
| ING | 2026-09-23 | needs_verification | [link](https://homeinvest.nl/wp-content/uploads/2026/09/ing-rentetarieven-23-09-2026.pdf) |
| Rabobank | 2026-09-21 | needs_verification | [link](https://homeinvest.nl/wp-content/uploads/2026/09/rabobank-rentetarieven-21-09-2026.pdf) |
| de Volksbank (ASN Bank) | 2026-09-26 | verified | [link](https://www.asnbank.nl/hypotheek/hypotheekrentes.html) |
| Nationale-Nederlanden | 2026-09-29 | needs_verification, derived | [link](https://www.actuelerentestanden.nl/hypotheek/rente/nationale-nederlanden) |
| Obvion | 2026-09-23 | verified | [link](https://obvion.nl/media/t2pjl2jb/rentetarieven-obvion-woon-hypotheek-23-september-2026.pdf) |
| Florius | 2026-09-21 | verified | [link](https://www.florius.nl/-/media/florius/files/rentepagina/renteblad-florius-profijt-drie-plus-drie-hypotheek.pdf) |
| Allianz | 2026-09-24 | verified | [link](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-49.pdf) |
| a.s.r. | 2026-09-26 | verified | [link](https://www.asr.nl/asr/api/asrnl/pod/getpdf?uri=/POD/r/Pdf/asr-renteblad.pdf) |
| Centraal Beheer | 2026-09-29 | verified | [link](https://www.centraalbeheer.nl/-/media/files/prive/hypotheek/rentelijsten/actueel/rentelijst-leef-hypotheek.pdf) |
| Argenta | 2026-09-28 | verified | [link](https://www.argenta.nl/hypotheek-argenta/hypotheekrente-overzicht) |
| MUNT Hypotheken | 2026-09-22 | verified | [link](https://www.munthypotheken.nl/rente/) |
| Lot Hypotheken | 2026-09-28 | verified | [link](https://www.lothypotheken.nl/consument/hypotheek/hypotheekrentes) |
| Tulp Hypotheken | 2026-09-24 | verified | [link](https://tulphypotheken.nl/wp-content/uploads/2026/09/Rentewijziging-Tulp-Riant-Hypotheek-per-24-september-2026.pdf) |
| Venn Hypotheken | 2026-09-23 | needs_verification | [link](https://homeinvest.nl/wp-content/uploads/2026/09/venn-rentetarieven-23-09-2026.pdf) |
| Hypotrust | 2026-09-18 | verified | [link](https://www.hypotrust.nl/uploads/hypotrust/files/Rentelijsten/Week-38-Elan-Plus-per-18-09-2026.pdf) |
| bijBouwe | 2026-09-25 | needs_verification | [link](https://homeinvest.nl/wp-content/uploads/2026/09/bijbouwe-rentetarieven-25-09-2026.pdf) |
| Lloyds Bank | 2026-09-18 | verified | [link](https://www.lloydsbank.nl/hypotheken/actuele-rentes-hypotheken) |

## ABN AMRO

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | onbekend | onbekend | – |
| Maximaal aflossingsvrij (% marktwaarde) | 30 | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-afsluiten/hypotheekvormen/aflossingsvrije-hypotheek/index.html) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/huis-kopen/verhuizen/index.html) |
| Verhuisregeling | true | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/huis-kopen/verhuizen/index.html) |
| Vast contract | true | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-berekenen/inkomen.html) |
| Intentieverklaring | true | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-berekenen/inkomen.html) |
| Flexibel inkomen (IBL) | onbekend | onbekend | – |
| Perspectiefverklaring | true | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-berekenen/inkomen-perspectiefverklaring.html) |
| Uitkering | onbekend | onbekend | – |
| Pensioen | true | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-berekenen/inkomen.html) |
| Overbrugging max. maanden | 24 | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/huis-kopen/verhuizen/overbruggingshypotheek/index.html) |
| Restschuld meefinancieren | true | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/mijn-hypotheek/restschuld/index.html) |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/mijn-hypotheek/extra-aflossen/index.html) |
| Rentemiddeling | true | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/mijn-hypotheek/hypotheekrente-wijzigen/rentemiddeling.html) |
| Rentekorting per energielabel | {"A++++":0.04,"A++++EPG":0.04,"A":0,"A+":0,"A++":0,"A+++":0,"B":-0.07,"C":-0.12,"D":-0.13,"E":-0.16,"F":-0.16,"G":-0.16,"geen":-0.16} | geverifieerd | [bron](https://hypotheken.abnamro.nl/interest-rates/app/?lang=nl) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://hypotheken.abnamro.nl/interest-rates/app/?lang=nl) |
| Afsluitkosten (€) | 750 | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-afsluiten/hypotheekadvies/kosten.html) |
| Bouwdepot | true | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-afsluiten/bouwdepot/index.html) |
| Overwaarde vrij opnemen | onbekend | onbekend | – |
| Verhogen voor zakelijk doel | onbekend | onbekend | – |
| Min. jaren cijfers | 1 | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-afsluiten/hypotheek-ondernemers.html) |
| Prognose voor starters | onbekend | onbekend | – |
| IVO-beleid | accepted | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-afsluiten/hypotheek-ondernemers.html) |
| Rekenmethode | onbekend | onbekend | – |
| Geaccepteerde rechtsvormen | ["eenmanszaak","vof","maatschap","cv","bv"] | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-afsluiten/hypotheek-ondernemers.html) |
| Behandeling DGA | salary_plus_distributable_profit | geverifieerd | [bron](https://www.abnamro.nl/nl/prive/hypotheken/hypotheek-afsluiten/hypotheek-ondernemers.html) |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | onbekend | onbekend | – |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## ING

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 30 | geverifieerd | [bron](https://www.banken.nl/nieuws/27131/ook-ing-scherpt-beleid-voor-aflossingsvrije-hypotheken-aan) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.ing.nl/particulier/hypotheek/huis-kopen/ander-huis-kopen/hypotheek-meenemen) |
| Verhuisregeling | true | geverifieerd | [bron](https://hypotheekmeeneemregeling.nl/verhuisregeling-ing/) |
| Vast contract | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Perspectiefverklaring | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Uitkering | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Pensioen | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Overbrugging max. maanden | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Restschuld meefinancieren | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.homefinance.nl/hypotheek/berekenen/ing/boetevrij-aflossen/) |
| Rentemiddeling | true | geverifieerd | [bron](https://www.ing.nl/particulier/hypotheek/jouw-hypotheek/tussentijds-aanpassen) |
| Rentekorting per energielabel | {"A+++":0.2,"A++++":0.2,"A++++EPG":0.2,"A":0.18,"A+":0.18,"A++":0.18,"B":0.1,"C":0.07,"D":0.03} | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2026/09/ing-rentetarieven-23-09-2026.pdf) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://homeinvest.nl/wp-content/uploads/2026/09/ing-rentetarieven-23-09-2026.pdf) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Min. jaren cijfers | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Prognose voor starters | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| IVO-beleid | accepted | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Rekenmethode | avg3_capped_by_last | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Geaccepteerde rechtsvormen | ["eenmanszaak","vof","maatschap","bv","bv_holding"] | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Behandeling DGA | salary_plus_distributable_profit | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | onbekend | onbekend | – |
| Hypotheek naast lening eigen BV | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/12/ING-acc-beleid-jan-2026.pdf) |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Rabobank

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 30 | geverifieerd | [bron](https://www.rabobank.nl/nieuws/011512344/rabobank-scherpt-beleid-voor-aflossingsvrije-hypotheek-aan-per-11-mei-2026) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.rabobank.nl/particulieren/hypotheek/hypotheekvormen-en-voorwaarden/basisvoorwaarden) |
| Verhuisregeling | true | geverifieerd | [bron](https://www.rabobank.nl/particulieren/hypotheek/hypotheekvormen-en-voorwaarden/plusvoorwaarden) |
| Vast contract | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Perspectiefverklaring | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Uitkering | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Pensioen | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Overbrugging max. maanden | 24 | geverifieerd | [bron](https://www.rabobank.nl/particulieren/hypotheek/hypotheekvormen-en-voorwaarden/hypotheekproducten/overbruggingshypotheek) |
| Restschuld meefinancieren | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.rabobank.nl/particulieren/hypotheek/hypotheekvormen-en-voorwaarden/basisvoorwaarden) |
| Rentemiddeling | true | geverifieerd | [bron](https://www.rabobank.nl/particulieren/hypotheek/mijn-hypotheek-of-woning-aanpassen/rente-aanpassen) |
| Rentekorting per energielabel | {"A":0.15,"A+":0.15,"A++":0.15,"A+++":0.15,"A++++":0.15,"A++++EPG":0.15} | geverifieerd | [bron](https://www.rabobank.nl/particulieren/hypotheek/hypotheekrente/duurzaamheidskorting) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://www.rabobank.nl/particulieren/hypotheek/hypotheekrente/duurzaamheidskorting) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Min. jaren cijfers | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Prognose voor starters | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| IVO-beleid | required | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Rekenmethode | ivo | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Geaccepteerde rechtsvormen | ["eenmanszaak","vof","maatschap","bv"] | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Behandeling DGA | ivo | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | 25 | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Hypotheek naast lening eigen BV | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2026/02/Rabobank-acceptatie-feb-2026.pdf) |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## de Volksbank (ASN Bank)

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 30 | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.asnbank.nl/downloads/informatiewijzer-asn-hypotheken.html) |
| Verhuisregeling | true | geverifieerd | [bron](https://www.asnbank.nl/hypotheek/informatie-voor-adviseurs/57-plussers.html) |
| Vast contract | true | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Perspectiefverklaring | true | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Uitkering | true | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Pensioen | true | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Overbrugging max. maanden | 18 | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Restschuld meefinancieren | true | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.asnbank.nl/downloads/informatiewijzer-asn-hypotheken.html) |
| Rentemiddeling | true | geverifieerd | [bron](https://www.asnbank.nl/hypotheek/mijn-asn-hypotheek/hypotheekrente-eerder-aanpassen.html) |
| Rentekorting per energielabel | {} | geverifieerd | [bron](https://www.asnbank.nl/downloads/rentetarieven-asn-bespaarhypotheek-per-26-september-2026.html) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://www.asnbank.nl/downloads/rentetarieven-asn-bespaarhypotheek-per-26-september-2026.html) |
| Afsluitkosten (€) | onbekend | onbekend | [bron](https://www.asnbank.nl/downloads/kostenoverzicht-wijzigen-hypotheek.html) |
| Bouwdepot | true | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Min. jaren cijfers | 1 | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Prognose voor starters | false | geverifieerd | [bron](https://www.asnbank.nl/hypotheek/hypotheek-voor-zzp-of-ondernemer.html) |
| IVO-beleid | required | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Rekenmethode | avg3_capped_by_last | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Geaccepteerde rechtsvormen | ["eenmanszaak","vof","maatschap","bv"] | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Behandeling DGA | salary_plus_distributable_profit | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Min. solvabiliteit (%) | 20 | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Min. current ratio | 1 | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | 25 | geverifieerd | [bron](https://www.zelfhypotheekafsluiten.nl/Uploads/geldverstrekkers/2026/09/asn-hypotheek-regels-voor-het-accepteren-en-verstrekken-van-een-hypotheek-23-juni-2026.pdf) |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Nationale-Nederlanden

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Meeneemregeling | true | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Verhuisregeling | true | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Vast contract | true | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Intentieverklaring | true | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Perspectiefverklaring | true | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Uitkering | true | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Pensioen | true | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Overbrugging max. maanden | 12 | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Restschuld meefinancieren | onbekend | onbekend | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.nn.nl/Download/Voorwaarden-NN-Hypotheek.htm) |
| Rentemiddeling | true | geverifieerd | [bron](https://www.nn.nl/Particulier/Hypotheken/Je-hypotheek/Hypotheekrente-wijzigen/Tussentijdse-rentewijziging-met-rentemiddeling.htm) |
| Rentekorting per energielabel | {} | geverifieerd | [bron](https://www.nn.nl/Hypotheekrente-overzicht.htm) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://www.nn.nl/Hypotheekrente-overzicht.htm) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | true | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Overwaarde vrij opnemen | onbekend | onbekend | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Min. jaren cijfers | 1 | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Prognose voor starters | onbekend | onbekend | – |
| IVO-beleid | required | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Rekenmethode | avg3_capped_by_last | geverifieerd | [bron](https://www.nn.nl/Particulier/Hypotheken/Een-hypotheek-voor-ondernemers.htm) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | ivo | geverifieerd | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | onbekend | onbekend | – |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | [bron](https://adviseur.nn.nl/hypotheken/informatie/acceptatiebeleid-hypotheken) |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Obvion

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://obvion.nl/media/kxudk0d2/product-en-acceptatiekaart.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 30 | geverifieerd | [bron](https://obvion.nl/hypotheek/vorm/aflossingsvrij/beleid-aflossingsvrij/) |
| Meeneemregeling | true | geverifieerd | [bron](https://obvion.nl/media/kxudk0d2/product-en-acceptatiekaart.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://obvion.nl/media/kxudk0d2/product-en-acceptatiekaart.pdf) |
| Vast contract | true | geverifieerd | [bron](https://obvion.nl/media/cneljkrz/acceptatiebeleid.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://obvion.nl/media/cneljkrz/acceptatiebeleid.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://obvion.nl/media/cneljkrz/acceptatiebeleid.pdf) |
| Perspectiefverklaring | true | geverifieerd | [bron](https://obvion.nl/media/cneljkrz/acceptatiebeleid.pdf) |
| Uitkering | true | geverifieerd | [bron](https://obvion.nl/media/cneljkrz/acceptatiebeleid.pdf) |
| Pensioen | true | geverifieerd | [bron](https://obvion.nl/media/cneljkrz/acceptatiebeleid.pdf) |
| Overbrugging max. maanden | 24 | geverifieerd | [bron](https://obvion.nl/hypotheek/afsluiten/overbruggingskrediet/) |
| Restschuld meefinancieren | true | geverifieerd | [bron](https://obvion.nl/media/kxudk0d2/product-en-acceptatiekaart.pdf) |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://obvion.nl/media/kxudk0d2/product-en-acceptatiekaart.pdf) |
| Rentemiddeling | false | geverifieerd | [bron](https://obvion.nl/media/kxudk0d2/product-en-acceptatiekaart.pdf) |
| Rentekorting per energielabel | {"A++++":0.2,"A++++EPG":0.2,"A":0.15,"A+":0.15,"A++":0.15,"A+++":0.15,"B":0.08} | geverifieerd | [bron](https://obvion.nl/media/t2pjl2jb/rentetarieven-obvion-woon-hypotheek-23-september-2026.pdf) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://obvion.nl/media/t2pjl2jb/rentetarieven-obvion-woon-hypotheek-23-september-2026.pdf) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | true | geverifieerd | [bron](https://obvion.nl/media/kxudk0d2/product-en-acceptatiekaart.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | [bron](https://obvion.nl/hypotheek/wijzigen/verhogen/) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://obvion.nl/hypotheek/wijzigen/verhogen/) |
| Min. jaren cijfers | 1 | geverifieerd | [bron](https://obvion.nl/adviseur/doelgroep/werken/ondernemers/) |
| Prognose voor starters | false | geverifieerd | [bron](https://obvion.nl/media/cneljkrz/acceptatiebeleid.pdf) |
| IVO-beleid | required | geverifieerd | [bron](https://obvion.nl/media/cneljkrz/acceptatiebeleid.pdf) |
| Rekenmethode | ivo | geverifieerd | [bron](https://obvion.nl/media/cneljkrz/acceptatiebeleid.pdf) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | ivo | geverifieerd | [bron](https://obvion.nl/media/cneljkrz/acceptatiebeleid.pdf) |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | onbekend | onbekend | – |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Florius

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://www.florius.nl/-/media/florius/files/rentepagina/renteblad-florius-profijt-drie-plus-drie-hypotheek.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 30 | geverifieerd | [bron](https://www.banken.nl/nieuws/26956/abn-amro-en-florius-beperken-aflossingsvrije-hypotheek-tot-30-procent-van-woningwaarde) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.florius.nl/-/media/florius/files/formulieren/voorwaarden/fl-vw02-profijt-hypotheek-per-1-oktober-2025.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://www.florius.nl/-/media/florius/files/formulieren/voorwaarden/fl-vw02-profijt-hypotheek-per-1-oktober-2025.pdf) |
| Vast contract | true | geverifieerd | [bron](https://www.florius.nl/situatie-wijzigt/hypotheek-zonder-vast-contract) |
| Intentieverklaring | true | geverifieerd | [bron](https://www.florius.nl/situatie-wijzigt/hypotheek-zonder-vast-contract) |
| Flexibel inkomen (IBL) | onbekend | onbekend | – |
| Perspectiefverklaring | true | geverifieerd | [bron](https://www.florius.nl/adviseurs/speciaal-voor/flexibele-inkomens/perspectiefverklaring) |
| Uitkering | onbekend | onbekend | – |
| Pensioen | onbekend | onbekend | – |
| Overbrugging max. maanden | onbekend | onbekend | – |
| Restschuld meefinancieren | onbekend | onbekend | – |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.florius.nl/-/media/florius/files/formulieren/voorwaarden/fl-vw02-profijt-hypotheek-per-1-oktober-2025.pdf) |
| Rentemiddeling | true | geverifieerd | [bron](https://www.florius.nl/hypotheekrente/renteafkoop-en-rentemiddeling) |
| Rentekorting per energielabel | {"A":0.15,"A+":0.15,"A++":0.15,"A+++":0.15,"A++++":0.15,"A++++EPG":0.15,"B":0.07,"C":0.04,"D":0.03} | geverifieerd | [bron](https://www.florius.nl/-/media/florius/files/rentepagina/renteblad-florius-profijt-drie-plus-drie-hypotheek.pdf) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://www.florius.nl/-/media/florius/files/rentepagina/renteblad-florius-profijt-drie-plus-drie-hypotheek.pdf) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | true | geverifieerd | [bron](https://www.florius.nl/-/media/florius/files/formulieren/voorwaarden/fl-vw02-profijt-hypotheek-per-1-oktober-2025.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | – |
| Verhogen voor zakelijk doel | onbekend | onbekend | – |
| Min. jaren cijfers | 1 | geverifieerd | [bron](https://www.florius.nl/hypotheek/hypotheek-ondernemers) |
| Prognose voor starters | false | geverifieerd | [bron](https://www.florius.nl/hypotheek/hypotheek-ondernemers) |
| IVO-beleid | accepted | geverifieerd | [bron](https://www.florius.nl/hypotheek/hypotheek-ondernemers) |
| Rekenmethode | avg3_capped_by_last | geverifieerd | [bron](https://www.florius.nl/hypotheek/hypotheek-ondernemers) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | onbekend | onbekend | – |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | onbekend | onbekend | – |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Allianz

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Vast contract | true | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Perspectiefverklaring | onbekend | onbekend | – |
| Uitkering | true | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Pensioen | true | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Overbrugging max. maanden | 24 | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Restschuld meefinancieren | onbekend | onbekend | – |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-46.pdf) |
| Rentemiddeling | true | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-46.pdf) |
| Rentekorting per energielabel | {} | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-49.pdf) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-49.pdf) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | true | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Overwaarde vrij opnemen | true | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Min. jaren cijfers | onbekend | onbekend | – |
| Prognose voor starters | onbekend | onbekend | – |
| IVO-beleid | required | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Rekenmethode | ivo | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | ivo | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | 5 | geverifieerd | [bron](https://www.allianz.nl/content/dam/onemarketing/benelu/allianz-nl/local/5/500083-47.pdf) |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## a.s.r.

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Vast contract | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Perspectiefverklaring | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Uitkering | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Pensioen | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Overbrugging max. maanden | 12 | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Restschuld meefinancieren | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.asrnederland.nl/-/media/files/asrnederland-nl/nieuws-en-pers/2026/20260430-asr-hypotheekproduct-en-contactkaart.pdf) |
| Rentemiddeling | false | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Rentekorting per energielabel | {} | geverifieerd | [bron](https://www.asr.nl/asr/api/asrnl/pod/getpdf?uri=/POD/r/Pdf/asr-renteblad.pdf) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://www.asr.nl/asr/api/asrnl/pod/getpdf?uri=/POD/r/Pdf/asr-renteblad.pdf) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | true | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Min. jaren cijfers | onbekend | onbekend | – |
| Prognose voor starters | onbekend | onbekend | – |
| IVO-beleid | required | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Rekenmethode | ivo | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | ivo | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | 5 | geverifieerd | [bron](https://hypotheekcompany.nl/wp-content/uploads/2025/06/Hypotheekgids-juni-2025.pdf) |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Centraal Beheer

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Vast contract | true | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Perspectiefverklaring | onbekend | onbekend | – |
| Uitkering | true | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Pensioen | true | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Overbrugging max. maanden | 12 | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Restschuld meefinancieren | onbekend | onbekend | – |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Rentemiddeling | true | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Rentekorting per energielabel | {"A+":0.05,"A++":0.05,"A+++":0.05,"A++++":0.05,"A++++EPG":0.05} | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/prive/hypotheek/rentelijsten/actueel/rentelijst-leef-hypotheek.pdf) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://www.centraalbeheer.nl/-/media/files/prive/hypotheek/rentelijsten/actueel/rentelijst-leef-hypotheek.pdf) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | true | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Min. jaren cijfers | 1 | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Prognose voor starters | false | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| IVO-beleid | accepted | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Rekenmethode | avg3_capped_by_last | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Geaccepteerde rechtsvormen | ["eenmanszaak","maatschap","cv","vof","bv","bv_holding"] | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Behandeling DGA | onbekend | onbekend | – |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | 5 | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Hypotheek naast lening eigen BV | true | geverifieerd | [bron](https://www.centraalbeheer.nl/-/media/files/voor-adviseurs/acceptatiegids-leef-hypotheek.pdf) |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Argenta

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 30 | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Vast contract | true | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Perspectiefverklaring | true | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Uitkering | true | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Pensioen | true | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekkaart.pdf) |
| Overbrugging max. maanden | 24 | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Restschuld meefinancieren | onbekend | onbekend | – |
| Boetevrij aflossen (% per jaar) | onbekend | onbekend | – |
| Rentemiddeling | false | geverifieerd | [bron](https://www.argenta.nl/contact/veelgestelde-vragen/hypotheek/heeft-argenta-rentemiddeling-of-rentebedenktijd) |
| Rentekorting per energielabel | {"A":0.1,"A+":0.1,"A++":0.1,"A+++":0.1,"A++++":0.1,"A++++EPG":0.1,"B":0.05} | geverifieerd | [bron](https://www.argenta.nl/hypotheek-argenta/hypotheekrente-overzicht) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://www.argenta.nl/hypotheek-argenta/hypotheekrente-overzicht) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | true | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Overwaarde vrij opnemen | true | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Min. jaren cijfers | 1 | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Prognose voor starters | onbekend | onbekend | – |
| IVO-beleid | accepted | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Rekenmethode | onbekend | onbekend | – |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | onbekend | onbekend | – |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | onbekend | onbekend | – |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://www.argenta.nl/sites/default/files/documents/Argenta_Hypotheekgids.pdf) |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## MUNT Hypotheken

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Vast contract | true | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Perspectiefverklaring | true | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Uitkering | true | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Pensioen | true | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Overbrugging max. maanden | 30 | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Restschuld meefinancieren | true | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Boetevrij aflossen (% per jaar) | onbekend | onbekend | – |
| Rentemiddeling | onbekend | onbekend | – |
| Rentekorting per energielabel | {} | te verifiëren | – |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | – |
| Afsluitkosten (€) | 0 | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Bouwdepot | true | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Min. jaren cijfers | 1 | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Prognose voor starters | onbekend | onbekend | – |
| IVO-beleid | required | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Rekenmethode | ivo | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | ivo | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Min. solvabiliteit (%) | 10 | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | 5 | geverifieerd | [bron](https://www.munthypotheken.nl/site/assets/files/2893/munt_hypotheekgids_2026-2.pdf) |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Lot Hypotheken

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Vast contract | true | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Perspectiefverklaring | true | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Uitkering | true | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Pensioen | true | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Overbrugging max. maanden | 24 | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Restschuld meefinancieren | onbekend | onbekend | – |
| Boetevrij aflossen (% per jaar) | 15 | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Rentemiddeling | onbekend | onbekend | – |
| Rentekorting per energielabel | {"A":0.1,"A+":0.1,"A++":0.1,"A+++":0.1,"A++++":0.1,"A++++EPG":0.1} | geverifieerd | [bron](https://www.lothypotheken.nl/consument/hypotheek/hypotheekrentes) |
| Rentekorting per label (> 10 jaar vast) | {"A":0.03,"A+":0.03,"A++":0.03,"A+++":0.03,"A++++":0.03,"A++++EPG":0.03} | geverifieerd | [bron](https://www.lothypotheken.nl/consument/hypotheek/hypotheekrentes) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | true | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Min. jaren cijfers | 1 | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Prognose voor starters | onbekend | onbekend | – |
| IVO-beleid | required | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Rekenmethode | ivo | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | ivo | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | 5 | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://adviseur.lothypotheken.nl/media/koxceg2q/hypotheekgids-lot-hypotheken-versie-januari-2026.pdf) |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Tulp Hypotheken

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 106 | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/03/Productkaart-Tulp-riant-1.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/03/Productkaart-Tulp-riant-1.pdf) |
| Vast contract | true | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/03/Productkaart-Tulp-riant-1.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Perspectiefverklaring | onbekend | onbekend | – |
| Uitkering | true | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Pensioen | true | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Overbrugging max. maanden | 12 | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/03/Productkaart-Tulp-riant-1.pdf) |
| Restschuld meefinancieren | onbekend | onbekend | – |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Rentemiddeling | onbekend | onbekend | – |
| Rentekorting per energielabel | {} | te verifiëren | – |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | – |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | onbekend | onbekend | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/03/Productkaart-Tulp-riant-1.pdf) |
| Overwaarde vrij opnemen | true | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/03/Productkaart-Tulp-riant-1.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/03/Productkaart-Tulp-riant-1.pdf) |
| Min. jaren cijfers | 1 | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Prognose voor starters | onbekend | onbekend | – |
| IVO-beleid | required | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Rekenmethode | ivo | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | ivo | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | 5 | geverifieerd | [bron](https://tulphypotheken.nl/wp-content/uploads/2026/01/Acceptatiegids-Tulp-Riant-Hypotheek-januari-2026.pdf) |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Venn Hypotheken

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Vast contract | true | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Intentieverklaring | onbekend | onbekend | – |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Perspectiefverklaring | onbekend | onbekend | – |
| Uitkering | true | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Pensioen | onbekend | onbekend | – |
| Overbrugging max. maanden | 24 | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Restschuld meefinancieren | onbekend | onbekend | – |
| Boetevrij aflossen (% per jaar) | 15 | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Rentemiddeling | onbekend | onbekend | – |
| Rentekorting per energielabel | {} | te verifiëren | – |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | – |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | onbekend | onbekend | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | – |
| Verhogen voor zakelijk doel | onbekend | onbekend | – |
| Min. jaren cijfers | 3 | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Prognose voor starters | onbekend | onbekend | – |
| IVO-beleid | required | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Rekenmethode | weighted | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | onbekend | onbekend | – |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | onbekend | onbekend | – |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | 100 | geverifieerd | [bron](https://homeinvest.nl/wp-content/uploads/2025/03/Venn-productkaart_april-2025.pdf) |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Hypotrust

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 106 | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Vast contract | true | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Perspectiefverklaring | false | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Uitkering | true | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Pensioen | true | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Overbrugging max. maanden | 12 | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Restschuld meefinancieren | false | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Rentemiddeling | false | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Rentekorting per energielabel | {} | te verifiëren | – |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | – |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | onbekend | onbekend | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Overwaarde vrij opnemen | true | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Min. jaren cijfers | 3 | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Prognose voor starters | false | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| IVO-beleid | required | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Rekenmethode | ivo | geverifieerd | [bron](https://www.hypotrust.nl/uploads/hypotrust/files/Acceptatiekader-Hypotrust-Elan-Plus-januari-2026.pdf) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | onbekend | onbekend | – |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | onbekend | onbekend | – |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## bijBouwe

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 106 | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/5oye1v1jrbu3/productkaart-bijbouwe-vooruit-042026.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/5oye1v1jrbu3/productkaart-bijbouwe-vooruit-042026.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Verhuisregeling | true | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Vast contract | true | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Perspectiefverklaring | false | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Uitkering | true | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Pensioen | true | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Overbrugging max. maanden | onbekend | onbekend | – |
| Restschuld meefinancieren | false | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/5oye1v1jrbu3/productkaart-bijbouwe-vooruit-042026.pdf) |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/5oye1v1jrbu3/productkaart-bijbouwe-vooruit-042026.pdf) |
| Rentemiddeling | false | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/5oye1v1jrbu3/productkaart-bijbouwe-vooruit-042026.pdf) |
| Rentekorting per energielabel | {} | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Afsluitkosten (€) | 950 | geverifieerd | [bron](https://bijbouwe.nl/) |
| Bouwdepot | onbekend | onbekend | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Overwaarde vrij opnemen | true | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/5oye1v1jrbu3/productkaart-bijbouwe-vooruit-042026.pdf) |
| Verhogen voor zakelijk doel | onbekend | onbekend | [bron](https://dynamic-credit-xmn7.files.prepr.io/5oye1v1jrbu3/productkaart-bijbouwe-vooruit-042026.pdf) |
| Min. jaren cijfers | 3 | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Prognose voor starters | false | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| IVO-beleid | required | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Rekenmethode | ivo | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Geaccepteerde rechtsvormen | ["eenmanszaak","vof","maatschap","bv"] | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Behandeling DGA | ivo | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Min. solvabiliteit (%) | onbekend | onbekend | – |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | 5 | geverifieerd | [bron](https://dynamic-credit-xmn7.files.prepr.io/2926eb8qexqw/acceptatiehandleiding-bijbouwe-vooruit-september-2026.pdf) |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |

## Lloyds Bank

| Criterium | Waarde | Status | Bron |
|---|---|---|---|
| Maximale LTV (%) | 106 | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Maximaal aflossingsvrij (% marktwaarde) | 50 | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Meeneemregeling | true | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Verhuisregeling | onbekend | onbekend | – |
| Vast contract | true | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Intentieverklaring | true | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Flexibel inkomen (IBL) | true | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Perspectiefverklaring | false | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Uitkering | true | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Pensioen | true | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Overbrugging max. maanden | 12 | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Restschuld meefinancieren | onbekend | onbekend | – |
| Boetevrij aflossen (% per jaar) | 10 | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Rentemiddeling | onbekend | onbekend | – |
| Rentekorting per energielabel | {"A":0.05,"A+":0.05,"A++":0.05,"A+++":0.05,"A++++":0.05,"A++++EPG":0.05} | geverifieerd | [bron](https://www.lloydsbank.nl/hypotheken/actuele-rentes-hypotheken) |
| Rentekorting per label (> 10 jaar vast) | onbekend | onbekend | [bron](https://www.lloydsbank.nl/hypotheken/actuele-rentes-hypotheken) |
| Afsluitkosten (€) | onbekend | onbekend | – |
| Bouwdepot | onbekend | onbekend | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Overwaarde vrij opnemen | onbekend | onbekend | – |
| Verhogen voor zakelijk doel | onbekend | onbekend | – |
| Min. jaren cijfers | 2 | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Prognose voor starters | onbekend | onbekend | – |
| IVO-beleid | required | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Rekenmethode | avg3_capped_by_last | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Geaccepteerde rechtsvormen | onbekend | onbekend | – |
| Behandeling DGA | ivo | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Min. solvabiliteit (%) | 0 | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Min. current ratio | onbekend | onbekend | – |
| Management fee telt mee | onbekend | onbekend | – |
| DGA vanaf aandelenbelang (%) | 5 | geverifieerd | [bron](https://www.lloydsbank.nl/dam/jcr:96a5a341-9ea6-4015-b53d-8bf87a36a681/hypotheekgids.pdf) |
| Hypotheek naast lening eigen BV | onbekend | onbekend | – |
| Behandeling borgstellingen | onbekend | onbekend | – |
| Maximale LTV (%) | onbekend | onbekend | – |
| Max. aflossingsvrij ondernemer (%) | onbekend | onbekend | – |
