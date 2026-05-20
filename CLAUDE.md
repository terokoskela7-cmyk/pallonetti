# PALLONETTI.FI — Claude Code Briefing
> Liitä tämä tiedosto Claude Code -sessioon kun aloitat kehityksen.
> Viimeksi päivitetty: 2026-05-19

---

## 1. PROJEKTI LYHYESTI

**Pallonetti.fi** on suomalaisen jalkapallon nuorten pelaajien peliaikaa visualisoiva julkinen data-alusta. Malli on ruotsalainen bolldata.se — ei AI-tuote, ei fantasy-peli, ei marketplace. Pelkkä data selkeästi esitettynä.

**Ydinkysymys:** *"Kuka alle 23-vuotias suomalainen pelaaja saa peliaikaa Veikkausliigassa?"*

**Brändi:** Itsenäinen. TalentMasterID mainitaan vain footerin pikkutekstissä. Ei "Pohjoismaiden johtava alusta", ei "AI scouting".

---

## 1.5. NYKYINEN TILA (2026-05-19)

### Tuotanto

| Asia | Arvo |
|---|---|
| **Frontend** | `https://pallonetti-fi.web.app` (Firebase Hosting) |
| **Backend** | `https://europe-west1-pallonetti-fi.cloudfunctions.net/api` |
| **Region** | europe-west1 (kaikki Functions) |
| **API-versio** | `1.1.0` — tarkistettavissa `GET /api/health` |
| **Firebase-projekti** | `pallonetti-fi` |
| **API-Football-tilaus** | Pro (tukee 2026-kauden dataa) |
| **RAPIDAPI_KEY** | `functions/.env` (CI-step luo secretistä), luetaan axios-interceptorissa per pyyntö |
| **Viimeisin commit (`main` & `origin/main`)** | `eedb231` — *refactor: poista kuollut youthPlayersU21-laskenta dataAggregatorista* |
| **GitHub-repo** | https://github.com/terokoskela7-cmyk/pallonetti |
| **Paikallinen koodikanta** | `C:\Users\TeroKoskela\OneDrive - Suomen Palloliitto\Tiedostot\GitHub\pallonetti\` |

### Verifioitu API-Football sarjalista (2026-05-17)

Tarkistettu suoraan `GET /leagues?country=Finland&season=2026`:

| League ID | Sarja | Tyyppi |
|---|---|---|
| **244** | Veikkausliiga | League — pääsarja |
| **1087** | Ykkösliiga | League |
| **245** | Ykkönen | League |
| **640** | Kansallinen Liiga (naisten) | League — Sprint 6+ |
| 247/248/249 | Kakkonen (Lohko A/B/C) | League — myöhemmin |
| 899 | League Cup | Cup |
| 901 | Ykköscup | Cup |
| 246 | Suomen Cup | Cup |

**KRIITTINEN:** Älä koskaan käytä ID:tä 245 Ykkösliigan synonyyminä — se on Ykkönen. Älä käytä ID:tä 246 Ykkönen-synonyyminä — se on Suomen Cup. League ID -bugi korjattu commitilla *fix: korjaa Ykkosliiga (1087) ja Ykkonen (245) league ID:t*.

### Youth-stats endpointit (toimivat tuotannossa)

```
GET /api/youth-stats/2026         → vain Veikkausliiga, { success, data: YouthStats[] }
GET /api/youth-stats/2026/all     → kolme sarjaa yhdistettynä, { veikkausliiga, ykkosliiga, ykkonen }
```

Backend käyttää `fetchAllPages`-helperia, joka käy automaattisesti läpi API-Footballin 20:n erissä paginoidut sivut. Cache-avain sisältää league-ID:n: `youth_stats_${league}_${season}`.

---

## 2. KOODIKANTA — MITÄ ON OLEMASSA

### Repo-rakenne (juuri)
```
pallonetti/
├── functions/                ← Firebase Functions backend (TS, Node 20)
│   └── src/
│       ├── index.ts          ← 21 API-endpointia, Express
│       ├── config.ts         ← Ympäristö/avainten luku
│       ├── api/
│       │   ├── footballApi.ts       ← API-Football (RapidAPI)
│       │   ├── fbrefApi.ts          ← FBref scraper (xG, xA)
│       │   └── transfermarktApi.ts  ← Transfermarkt markkina-arvot
│       ├── services/
│       │   ├── dataAggregator.ts    ← Yhdistää lähteet
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
Cloud Functions on stateless → Map-pohjainen rate limiter nollautuu jokaisen kutsun välillä. MVP:ssä riittää että API-Football-rate-limit hoidetaan Firestore-cachella, mutta tiedosto on tällä hetkellä turha. Joko poistettava tai korvattava Firestore-pohjaisella.

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
| `RAPIDAPI_KEY` | RapidAPI dashboard → API-Football |
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

### API-Football (RapidAPI) — pääläde
- League IDs: 244 (Veikkausliiga), 1087 (Ykkösliiga), 245 (Ykkönen)
- Pro-tilaus
- Älä koskaan kutsu suoraan frontendistä — aina backendin kautta

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
TalentMaster-pilottiseuran juniori → näkyy pallonetti.fi /pelaaja/:id:ssä normaalisti API-Footballista → (manuaalinen) "Kehittyi [Seura]-akatemiassa" -merkintä. Ei automaattista Firebase-integraatiota.

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
