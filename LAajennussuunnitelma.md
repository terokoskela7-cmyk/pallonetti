# Pallotalentti.fi - Laajennussuunnitelma (Out of the Box)

## Vision: Suomen jalkapallon kattavin analytiikkasivusto

---

## UUDET MODUULIT

### 1. SUOMALAISET ULKOMAILLA (Tärkein lisäys)
**Miksi:** Suomen jalkapallon menestys riippuu ulkomailla pelaavista. He ovat roolimalleja nuorille.

**Sisältö:**
- **Reaaliaikainen tracker**: Missä suomalaiset pelaavat juuri nyt
- **Maa/liiga-kartta**: Visuaalinen kartta maailmasta - suomalaisten pelaajien sijainnit
- **Liigataso-jaottelu**: Top 5 -liigat, keskisuuret liigat, pienet liigat
- **Pelaajaprofiilit**: Kunkin pelaajan tilastot, peliaika, maalit, xG
- **Siirtohistoria**: Kuka on siirtynyt minne ja milloin
- **Kehityskaari**: Pelaajan uran eteneminen visualisoituna

**Datalähteet:**
- Transfermarkt API (markkina-arvot, seurat, sopimukset)
- API-Football (ottelutilastot ulkomailla)
- FBref (xG/xA ulkomaan sarjoissa)
- SuomiFutis.com / Futaaja.fi (uutiset)

**Pelaajia seurattavana (2026):**
| Pelaaja | Seura | Maa | Liiga | Ikä |
|---------|-------|-----|-------|-----|
| Joel Pohjanpalo | Palermo FC | Italia | Serie B | 30 |
| Benjamin Källman | Hannover 96 | Saksa | 2. Bundesliga | 25 |
| Casper Terho | Sparta Rotterdam | Hollanti | Eredivisie | 22 |
| Leo Walta | Swansea City | Wales | Championship | 21 |
| Robin Lod | Chicago Fire | USA | MLS | 32 |
| Onni Valakari | San Diego FC | USA | MLS | 29 |
| Glen Kamara | Etsii seuraa | - | - | 30 |
| Matias Siltanen | Djurgården IF | Ruotsi | Allsvenskan | 20 |
| Otto Ruoppi | FSV Mainz (kesä) | Saksa | Bundesliga | 20 |
| Tuomas Ollila | Paris FC | Ranska | Ligue 2 | 25 |
| Miro Tenho | Djurgården IF | Ruotsi | Allsvenskan | 29 |
| Fredrik Jensen | Asteras Tripolis | Kreikka | Super League | 28 |
| Jere Uronen | Asteras Tripolis | Kreikka | Super League | 30 |
| Marcus Forss | Middlesbrough? | Englanti | Championship | 26 |
| Oliver Antman | Nordsjælland | Tanska | Superliga | 23 |
| Anssi Suhonen | HSV / Öster | Saksa/Ruotsi | 2.Bundesliga | 24 |
| Sauli Väisänen | Ascoli (laina) | Italia | Serie B | 30 |
| Jeremiah Streng | Ascoli (laina) | Italia | Serie B | 25 |
| Pyry Soiri | Anagennisi Karditsa | Kreikka | Super League 2 | 30 |
| Tomas Galvez | SC Cambuur | Hollanti | Eerste Divisie | 21 |
| Miika Koskela | Haugesund | Norja | Eliteserien | 23 |
| Lauri Laine | Baník Ostrava | Tšekki | Fortuna Liga | 24 |
| Doni Arifi | Greuther Fürth | Saksa | 2. Bundesliga | 22 |
| Nikolai Alho | Asteras Tripolis | Kreikka | Super League | 32 |
| Robert Ivanov | Asteras Tripolis | Kreikka | Super League | 28 |

### 2. NAISTEN JALKAPALLO
**Miksi:** Naisjalkapallo kasvaa valtavasti. Suomen naisilla on menestyksekäs historia.

**Sisältö:**
- **Kansallinen Liiga**: Sarjataulukko, tilastot, nuorten pelaajien seuranta
- **Helmarit (A-maajoukkue)**: Ottelut, kokoonpanot, tilastot
- **Nuorten maajoukkueet**: U17, U19, U23
- **Naisten Veikkausliiga vs Miesten**: Vertailu peliajasta, resursseista
- **Naistalentit**: Nuoret lupaukset Kansallisessa Liigassa

**Joukkueet Kansallisessa Liigassa 2026:**
1. KuPS W, 2. HPS W, 3. HJK Helsinki W, 4. Åland United W, 
5. Gnistan W, 6. PK-35 Vantaa W, 7. Ilves W, 8. VIFK W

**Datalähteet:**
- Palloliitto.fi (virallinen data)
- API-Football (jos saatavilla)
- Besoccer / Aiscore

### 3. MAAJOUKKUE-TRACKER
**Sisältö:**
- **Huuhkajat**: Ottelut, kokoonpanot, RPM-tilastot, karsinnat
- **Helmarit**: Naisten A-maajoukkue
- **Pikkuhuuhkajat**: U21-miehet
- **Nuorten maajoukkueet**: U19, U17, U15
- **Pelaajakierto**: Kuka debytoi, kuka nousee, kuka putoaa pois

### 4. KEHITYSKAARI & ENNUSTEET (AI/ML)
**Sisältö:**
- **Pelaajaprofiili-sivu**: Yksityiskohtainen analyysi jokaisesta pelaajasta
- **Kehityskaari**: Kuvaaja ikä vs. peliaika/maalit/xG
- **Vertailu Pohjoismaihin**: Suomi vs. Ruotsi vs. Norja vs. Tanska
- **"Similar Players"**: Koneoppimismalli ehdottaa samankaltaisia pelaajia
- **Transfer Predictor**: Ennuste seuraavasta siirrosta
- **Market Value Tracker**: Markkina-arvon kehitys ajan myötä

### 5. SIIRTOIKKUNA-TRACKER
**Sisältö:**
- **Reaaliaikainen seuranta**: Kuka siirtyy minne
- **Huhut vs. varmistetut**: Erottelu
- **Siirtokorvaukset**: Summat suomalaisittain
- **Suomi → Ulkomaa**: Veikkausliigasta lähtevät
- **Ulkomaa → Suomi**: Veikkausliigaan palaavat / tulevat
- **Sisäiset siirrot**: Veikkausliigasta toiseen

### 6. BENCHMARK & VERTAILU
**Sisältö:**
- **Pohjoismaat**: Suomi vs. Ruotsi (Allsvenskan) vs. Norja vs. Tanska
- **Nuorten peliaika**: Mikä maa antaa eniten vastuuta nuorille?
- **Siirtosummat**: Vertailu maiden välillä
- **Maajoukkueiden kehitys**: FIFA-ranking historiassa
- **Bolldata.se-vertailu**: Suomi vs. Ruotsi talenttituotannossa

---

## TEKNINEN TOTEUTUS

### Uudet API-integraatiot backendiin:
1. Transfermarkt-scraper (pelaajien ulkomaan tiedot)
2. FBref-international (ulkomaan sarjojen tilastot)
3. Maajoukkuedata (Palloliitto.fi)

### Uudet Firestore-kokoelmat:
- `players_abroad` - Suomalaiset ulkomailla
- `women_teams` - Naisten joukkueet
- `women_players` - Naisten pelaajat
- `national_team` - Maajoukkuekokoonpanot
- `transfers` - Siirrot
- `market_values` - Markkina-arvohistoria

### Uudet frontend-sivut:
1. `/ulkomaat` - Suomalaiset ulkomailla
2. `/naiset` - Naisten jalkapallo
3. `/maajoukkue` - Huuhkajat & Helmarit
4. `/siirrot` - Siirtoikkuna
5. `/vertailu` - Benchmark
