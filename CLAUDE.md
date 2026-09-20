# PALLONETTI.FI — Claude Code Briefing
> Liitä tämä tiedosto Claude Code -sessioon kun aloitat kehityksen.
> Viimeksi päivitetty: 2026-05-19

---

## 1. PROJEKTI LYHYESTI

**Pallonetti.fi** on suomalaisen jalkapallon nuorten pelaajien peliaikaa visualisoiva julkinen data-alusta. Malli on ruotsalainen bolldata.se — ei AI-tuote, ei fantasy-peli, ei marketplace. Pelkkä data selkeästi esitettynä.

**Ydinkysymys:** *"Kuka alle 23-vuotias suomalainen pelaaja saa peliaikaa Veikkausliigassa?"*

**Brändi:** Itsenäinen ja nimetön. Sivuston missään osassa ei mainita tekijää, TalentMasteria eikä Palloliittoa: ei footerissa, ei Tietoa-sivulla, ei metatiedoissa eikä yhteystiedoissa. Ei "Pohjoismaiden johtava alusta", ei "AI scouting".

---

## 1.5. NYKYINEN TILA (2026-05-19)

### Tuotanto

| Asia | Arvo |
|---|---|
| **Frontend** | `https://pallonetti-fi.web.app` (Firebase Hosting) |
| **Backend** | `https://europe-west1-pallonetti-fi.cloudfunctions.net/api` |
| **Region** | europe-west1 (kaikki Functions) |
| **API-versio** | `2.0.0` — tarkistettavissa `GET /api/health` (myos `/health` funktiota suoraan kutsuttaessa) |
| **Firebase-projekti** | `pallonetti-fi` |
| **Viimeisin commit (`main` & `origin/main`)** | `eedb231` — *refactor: poista kuollut youthPlayersU21-laskenta dataAggregatorista* |
| **GitHub-repo** | https://github.com/terokoskela7-cmyk/pallonetti |
| **Paikallinen koodikanta** | `C:\Users\TeroKoskela\OneDrive - Suomen Palloliitto\Tiedostot\GitHub\pallonetti\` |

### Youth-stats endpointit (toimivat tuotannossa)

```
GET /api/youth-stats/2026         → vain Veikkausliiga, { success, data: YouthStats[] }
GET /api/youth-stats/2026/all     → kolme sarjaa yhdistettynä, { veikkausliiga, ykkosliiga, ykkonen }
```

---

## 2. KOODIKANTA — MITÄ ON OLEMASSA

### Repo-rakenne (juuri)
```
pallonetti/
├── functions/                ← Firebase Functions backend (TS, Node 20)
│   └── src/
│       ├── index.ts          ← 21 API-endpointia, Express
│       ├── api/
│       │   ├── fbrefApi.ts          ← FBref scraper (xG, xA)
│       │   └── transfermarktApi.ts  ← Transfermarkt markkina-arvot
│       ├── services/
│       │   └── cacheService.ts      ← Firestore-cache
│       ├── types/index.ts           ← TS-tyypit
│       └── utils/rateLimiter.ts     ← (ks. huomautus alla)
├── webapp/                   ← React + Vite + TypeScript frontend
│   └── src/
│       ├── components/       ← 14 komponenttia, ks. alla
│       ├── pages/            ← HomePage, JoukkueetPage, PelaikaPage
│       ├── services/api.ts   ← Frontend API-client
│       └── hooks/            ← useApi
├── firebase.json             ← Hosting + Functions + Firestore config
├── firestore.rules
├── firestore.indexes.json
├── .firebaserc               ← `pallonetti-fi`
└── .github/workflows/deploy.yml  ← CI/CD
```

### Frontend-komponentit (13)

| Komponentti | Käyttötarkoitus |
|---|---|
| `Hero` | Etusivun hero-osio Unsplash-taustakuvalla |
| `WeeklyNarrative` | "Viime kierroksen tarina" — automaattinen narratiivi |
| `KPICard` | KPI-kortti sparkline-trendillä |
| `InsightBar` | Kaavioiden selittävä yläpalkki |
| `LeagueTabBar` | Sarja-välilehdet alasivuilla |
| `TeamRankingBar` | Joukkuelistan palkki |
| `AgeDistributionChart` | StackedBar U18–U23 per joukkue (Recharts) |
| `PlayerMinutesTable` | Sortable pelaajataulukko |
| `TopPlayersCard` | Top-5 pelaajaa (kortti) — datalogiikka kesken |
| `WhyMattersSection` | Miksi tämä on tärkeää — tutkimusdataan pohjautuva osio |
| `Layout` | Sivupohja (navbar + outlet) |
| `SeasonSelector` | Kauden valitsin |
| `TeamSelector` | Joukkueen valitsin |

### Sivut (3 / 5 MVP-sivusta toteutettu)

| Sivu | Status |
|---|---|
| `/` HomePage | ✅ Hero + WeeklyNarrative + KPI-kortit + TopPlayersCard + WhyMattersSection + CTA-linkit |
| `/peliaika` PelaikaPage | ✅ Ikäjakauma + sortable taulukko + filtterit |
| `/joukkueet` JoukkueetPage | ✅ Joukkuekortit, U23-%, keski-ikä, logot |
| `/pelaajat` | ❌ Ei toteutettu |
| `/pelaaja/:id` | ❌ Ei toteutettu |

---

## 3. TIEDOSSA OLEVAT KESKENERÄISYYDET

> Aiemmat 🔴-bugit (BUG 1–5, .firebaserc, indexes.json) korjattu sprintin 2026-05-16…17 aikana. Alla on jäljellä oleva tekninen velka.

### TopPlayersCard käyttää tyhjää listaa
`HomePage.tsx`:ssä `<TopPlayersCard players={[]} />` — komponentti renderöi placeholder-tilan, ei oikeaa top-5:tä. Top-listan laskentalogiikka pitää toteuttaa: top minuutit / maalit / syötöt U23-pelaajille.

### KPI-korttien sparkline-arvot ovat placeholdereita
`HomePage.tsx` riveillä 87–108: `sparkline={[15, 17, 19, 22, vPct]}` jne. Vain viimeinen arvo on todellinen — vuosien 2022–2025 historia on keksitty. Korvattava TASO-/historia-datasta kun saatavilla.

### `rateLimiter.ts` on in-memory
Cloud Functions on stateless → Map-pohjainen rate limiter nollautuu jokaisen kutsun välillä. Tiedosto on tällä hetkellä turha. Joko poistettava tai korvattava Firestore-pohjaisella.

---

## 3.4. COMMITOINTI — PAKOLLINEN SÄÄNTÖ

**Ei `git add -A` eikä `git add .`.** Tiedostot lisätään nimeltä.

Ennen jokaista commitia ajetaan `git diff --cached --stat`, ja listan on
vastattava PR:n aihetta. Jos listalla on tiedosto, joka ei kuulu aiheeseen,
sitä ei commitoida mukaan.

**Jokaisen PR:n kuvaukseen liitetään `git diff --stat origin/main...HEAD`,**
ja jokainen listan tiedosto perustellaan PR:n aiheella. Jos tiedostoa ei voi
perustella, se ei kuulu tähän PR:ään.

**Työpuussa commitoimatta olevaa muutosta ei jätetä roikkumaan.** Se joko
commitoidaan omaan haaraansa tai siitä raportoidaan käyttäjälle. Roikkuva
muutos päätyy seuraavaan committiin riippumatta siitä, mihin se kuuluu.

**Miksi:** 2026-09-19 commit `fdb379d` ("markkina-arvot piiloon") vei mainiin
109 riviä `haeKansalaisuudet.ts`:ään — maakoodien normalisoinnin, raporttitilan
ja minuuttiluokittelun — koska ne olivat työpuussa committoimatta ja
`git add -A` pyyhkäisi ne mukaan. Seuraukset: PR:n kuvaus ei vastannut sen
sisältöä, katselmointi kohdistui väärään asiaan, ja seuraava haara joutui
konfliktiin muutoksesta, jota sen ei pitänyt koskea.

---

## 3.5. TUOTANTOON KIRJOITTAMINEN — PAKOLLINEN SÄÄNTÖ

**Tuotannon Firestoreen kirjoitetaan vain kahdella ehdolla yhtä aikaa:**

1. **Kahden lipun skriptillä.** Kirjoitus vaatii `--vahvista` ja lisäksi
   `--tuotanto`. Oikeisiin kokoelmanimiin kirjoittaminen vaatii vielä
   kolmannen, tahallisen lipun `--oikeat-kokoelmat`; ilman sitä kohde on
   `--etuliite`-kokoelma. Lippuja ei ohiteta eikä vartijoita löysätä.
2. **Käyttäjän chatissa antamalla hyväksynnällä.** Luvut näytetään ennen
   jokaista kirjoitusvaihetta, ja kirjoitus tehdään vasta kun käyttäjä on
   hyväksynyt ne. Aiempi hyväksyntä ei kata seuraavaa ajoa.

Poistot ovat aina ihmisen päätös. Tuonti merkitsee lähteestä poistuneet
vanhentuneiksi, ei poista niitä. Poistettavan dokumentin sisältö kirjataan
ennen poistoa (commit-viesti tai loki), jotta poisto on jäljitettävissä.

Sama koskee ad hoc -skriptejä: jos skripti kirjoittaa tuotantoon, sillä on
oltava sama kahden lipun vartija ja sama esikatselu kuin kausituonnilla.

### Sarja on osa avainta — ja miksi kausidokumentti ei ole

Sarja (Veikkausliiga / Ykkösliiga) on osa jokaista avainta, koska
nimittäjä on sarjakohtainen:

```
suoritukset/{sarja}_{kausi}_{vaihe}_{joukkue}_{pelaajaAvain}
nimittajat/{sarja}_{kausi}_{vaihe}_{joukkue}
kaudet/{sarja}_{kausi}
seasons/{kausi}/players/{sarja}_{slug}
seasons/{kausi}/tilannekuvat/{sarja}_{pvm}
```

**Kausidokumentti `seasons/{kausi}` on tarkoituksella sarjaton.** Sen alla
ovat myös `kansalaisuudet` ja `tilannekuvat`, jotka on kerätty ennen
sarjajakoa. Sarjallinen kausidokumentti (`seasons/{sarja}_{kausi}`) olisi
orpouttanut ne ja vaatinut oman siirtonsa. Sarja on sen sijaan
pelaajadokumentin avaimessa, mikä riittää: sama pelaaja voi olla samalla
kaudella molemmissa sarjoissa ilman että dokumentit osuvat toisiinsa.

**Sarja suodatetaan aina muistissa, ei `where`-ehdolla.** Vanhoissa
dokumenteissa kenttää ei ole, ja `where` jättäisi ne pois — jolloin
Veikkausliigan luvut muuttuisivat äänettömästi. Puuttuva kenttä tarkoittaa
Veikkausliigaa. Sama periaate kuin `vanhentunut`-kentällä.

**Vanhentuneiden merkintä on sarjakohtainen.** Ilman sitä toisen sarjan
tuonti merkitsisi saman kauden toisen sarjan rivit vanhentuneiksi. Merkintä
koskee suorituksia, nimittäjiä, projektioita JA kausidokumentteja: vanha
nimittäjä kasvattaa kapasiteettia ja pienentää osuutta, vanha
kausidokumentti näkyy kautena kahdesti.

### Tuotannon päätepisteen kutsuminen on tuotantotoimenpide

Tuotannon päätepistettä ei kutsuta sen selvittämiseksi, mitä se tekee.
Kutsu on sallittu vasta, kun **koodista on luettu**, että reitti on pelkkä
luku. **HTTP-metodi ei riitä perusteeksi:** GET-reitti voi tyhjentää
välimuistin, käynnistää uudelleenhaun tai kirjoittaa Firestoreen — näin
kävi `refreshData`-funktiolla 20.9.2026, jolloin varmistuskutsu tyhjensi
`cache`-kokoelman.

Jos reitin vaikutus on epäselvä, testi ajetaan emulaattoria vasten, ei
tuotantoa vasten.

---

## 4. DEPLOY

### Manuaalinen deploy (paikalliselta koneelta)
```
cd webapp ; npm run build
cd ..\functions ; npm run build
firebase deploy --only functions,hosting,firestore
```

### CI/CD
`.github/workflows/deploy.yml` ajaa kaikki push:t `main`-haaraan. Vaatii GitHub Secretit:

| Secret | Arvo |
|---|---|
| `FIREBASE_PROJECT_ID` | `pallonetti-fi` |
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON base64-koodattuna |
| `FIREBASE_API_URL` | `https://europe-west1-pallonetti-fi.cloudfunctions.net/api` |

### Smoke-testit deployn jälkeen
```
BASE=https://europe-west1-pallonetti-fi.cloudfunctions.net/api
curl $BASE/health
curl $BASE/youth-stats/2026
curl $BASE/youth-stats/2026/all
curl $BASE/youth-aggregation/2026
```

---

## 5. API-ENDPOINTIT — KAIKKI 21

| Endpoint | Kuvaus | Käytetään sivulla |
|---|---|---|
| `GET /health` | Terveystarkistus | - |
| `GET /api/seasons` | Kaikki kaudet | - |
| `GET /api/seasons/:year` | Kauden tiedot | - |
| `GET /api/standings/:season` | Sarjataulukko | /joukkueet, etusivu |
| `GET /api/teams/:season` | Joukkueet | /joukkueet |
| `GET /api/teams/:season/:teamId/players` | Joukkueen pelaajat | /joukkueet/:id |
| `GET /api/players/:season` | Kaikki pelaajat tilastoineen | /pelaajat (kesken) |
| `GET /api/players/:season/market-values` | Pelaajat + markkina-arvot | /pelaaja/:id (kesken) |
| `GET /api/team-market-values` | Joukkueiden markkina-arvot | /joukkueet |
| `GET /api/youth-stats/:season` | **U18-U23 peliaika joukkueittain** (Veikkausliiga) | /peliaika, etusivu |
| `GET /api/youth-stats/:season/all` | **U18-U23 peliaika 3 sarjasta** | /peliaika, etusivu |
| `GET /api/youth-aggregation/:season` | **Liigan KPI-luvut** | Etusivu KPI-pallo |
| `GET /api/matches/:season` | Kaikki ottelut | /ottelut (kesken) |
| `GET /api/matches/:season/upcoming` | Tulevat ottelut | /ottelut |
| `GET /api/matches/:season/recent` | Viimeisimmät ottelut | etusivu |
| `GET /api/fbref/:season/players` | FBref xG/xA tilastot | /pelaaja/:id |
| `GET /api/fbref/:season/standings` | FBref sarjataulukko | fallback |
| `GET /api/transfermarkt/players` | TM markkina-arvot | /pelaaja/:id |
| `GET /api/transfermarkt/team-values` | TM joukkuearvot | /joukkueet |
| `POST /api/admin/refresh/:season` | Force cache refresh | Admin |
| `GET /api/admin/cache-stats` | Cache-tilastot | Admin |
| `POST /api/admin/cache-cleanup` | Poista vanhentuneet | Admin |

---

## 6. CACHE TTL-ARVOT

| Datatyyppi | TTL | Peruste |
|---|---|---|
| standings | 2h | Muuttuu vain ottelun jälkeen |
| players | 6h | Päivittyy hitaasti |
| youth_stats | 6h | Päädata — riittää 6h |
| matches | 1h | Tulokset |
| lineups | 30min | Julkaistaan lähellä ottelua |
| transfermarkt | 24h | Markkina-arvot muuttuvat harvoin |
| fbref_stats | 12h | FBref päivittää hitaammin |

---

## 7. FRONTEND — STACK & TYYLI

### Stack
```
React 18 + TypeScript + Vite 5
Tailwind CSS v3
Recharts (kaaviot)
react-router-dom v7
```

### Väripaletti (PAKOLLINEN)
```css
--navy:    #0F1D32;  /* Tausta */
--ice:     #00C8FF;  /* Pääväri, aksentti */
--aurora:  (gradientti — ks. tailwind.config) /* Otsikkoaksentti */
--white:   #FFFFFF;
--gray:    #8899AA;
--green:   #22C55E;  /* Positiivinen trendi */
--red:     #EF4444;  /* Negatiivinen trendi */
```

### Hero-tausta (HomePage.tsx)
```
https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80
```

---

## 8. DATALÄHTEET

### Veikkausliigan tilastovienti — päälähde
- Kauden Excel-vienti → `suoritukset`, `nimittajat`, `kaudet`, `seasons/{kausi}/players`
- Kaikki peliaikaluvut lasketaan tästä
- Tuonti tehdään admin-sivulta tai kahden lipun skriptillä (ks. 3.5)

### Veikkausliigan pelaajarekisteri
- Kansalaisuus ja pelipaikka pelaajan profiilisivulta
- Yksi koodi per pelaaja: ei kerro kaksoiskansalaisuutta

### FBref (scraper)
- xG / xA -tiedot
- FBref piilottaa taulukot HTML-kommentteihin — käsitellään `fbrefApi.ts`:ssä
- Hauras: voi hajota jos FBref muuttaa rakennetta

### Transfermarkt (epävirallinen API)
- `transfermarkt-api.vercel.app` -välityspalvelu
- Harmaa-alue juridisesti — ei kaupalliseen scrape-myyntiin
- HJK:n ID on `3321`

### Suomalaiset ulkomailla — EI vielä backendissä
- Tarvitaan oma toteutus, ei MVP:ssä
- Tämä on pallonetti.fi:n uniikki lisäarvo bolldata.se:hen verrattuna

---

## 9. MITÄ EI RAKENNETA (scope freeze)

- ClubOS, AgentHub, TalentDraft Fantasy — Kimi-agentin ideointia
- AI scouting, match predictor, virtual transfer simulator
- Käyttäjärekisteröinti / kirjautuminen
- Maksullinen Pro-tilaus
- Push-notifikaatiot
- Naisten Kansallinen Liiga (Sprint 6+)
- Pohjoismainen vertailu (vaatii Allsvenskan/Eliteserien-datan)

**Huom:** `AgentHub.tsx` (~27 KB) säilytetään `app/src/pages/AgentHub.tsx`:ssä tulevaisuuden referenssinä — ei deletoida, mutta ei myöskään rakenneta MVP:hen.

---

## 10. YHTEYS TALENTMASTER-SISARPROJEKTIIN

Erilliset Firebase-projektit, ei jaettua dataa MVP:ssä.

| Projekti | Firebase | Koodihakemisto |
|---|---|---|
| TalentMaster (junior-SaaS) | `talentmaster-pilot` | `C:\Users\TeroKoskela\talentmaster\` |
| Pallonetti.fi (julkinen U23) | `pallonetti-fi` | `C:\Users\TeroKoskela\OneDrive - Suomen Palloliitto\Tiedostot\GitHub\pallonetti\` |

Mahdollinen linkitys (Q4 2026, ei nyt):
TalentMaster-pilottiseuran juniori → näkyy pallonetti.fi /pelaaja/:slug:ssä normaalisti kausituonnin datasta → (manuaalinen) "Kehittyi [Seura]-akatemiassa" -merkintä. Ei automaattista Firebase-integraatiota.

---

## 11. ALOITUSKOMENTO (kopioi seuraavaan sessioon)

```
Olen pallonetti.fi-projektin kehittäjä. CLAUDE.md ja SESSION.md on luettu.

Projekti: Suomalaisen jalkapallon U23-peliaika-alusta (bolldata.se-malli)
Live: https://pallonetti-fi.web.app
Backend: https://europe-west1-pallonetti-fi.cloudfunctions.net/api
Repo: C:\Users\TeroKoskela\OneDrive - Suomen Palloliitto\Tiedostot\GitHub\pallonetti\
Viimeisin commit: eedb231 (refactor: poista kuollut youthPlayersU21-laskenta dataAggregatorista)

Avoimet asiat: ks. SESSION.md.
Tämän päivän tehtävä: [kerro mitä haluat tehdä]
```

---

*Päivitetty 2026-05-19 — pohjautuu paikalliseen koodikanta-analyysiin (`pallonetti/`).*
